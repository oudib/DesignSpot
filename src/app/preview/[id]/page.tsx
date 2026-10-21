import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import Logo from "@/components/Logo";
import DeliverySwitcher from "@/components/DeliverySwitcher";
import PreviewFrame from "@/components/PreviewFrame";
import { groupRevisions } from "@/lib/revisions";

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Every version of the deliverable the requested Drive id belongs to, oldest
 * first. A preview link shared in Linear points at whichever version existed
 * when it was posted, so the chain is resolved from that row.
 */
async function revisionChain(requested: { id: string; rootId: string | null }) {
  const rootId = requested.rootId ?? requested.id;
  return prisma.designAttachment.findMany({
    where: { OR: [{ id: rootId }, { rootId }] },
    orderBy: { version: "asc" },
  });
}

/**
 * The other deliveries a reviewer may want to flip to from this preview: every
 * design delivered for the same ticket (or, for a design with no ticket, every
 * design in the same flow) that has a previewable file. Each entry points at
 * the newest version of that delivery's main file — an HTML export when there
 * is one, otherwise its first file.
 */
async function siblingDeliveries(design: {
  id: string;
  flowId: string;
  ticketId: string | null;
}) {
  const designs = await prisma.design.findMany({
    where: design.ticketId ? { ticketId: design.ticketId } : { flowId: design.flowId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: { attachments: { orderBy: { createdAt: "asc" } } },
  });
  return designs.flatMap((d) => {
    const latest = groupRevisions(d.attachments).map((g) => g.latest);
    const main = latest.find((a) => a.kind === "html") ?? latest[0];
    if (!main) return [];
    return [
      {
        id: d.id,
        title: d.title,
        variant: d.variant,
        path: main.path,
        fileName: main.name.replace(/\.[a-z0-9]+$/i, ""),
        createdAt: d.createdAt,
      },
    ];
  });
}

/**
 * Sibling deliveries are usually named "Feature - Screen A", "Feature - Screen
 * B"… so the tabs show only the part that differs. Returns the full titles when
 * there is no shared lead-in or stripping it would leave a tab blank.
 */
function distinctLabels(titles: string[]): string[] {
  if (titles.length < 2) return titles;
  let prefix = titles[0];
  for (const t of titles.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < t.length && prefix[i] === t[i]) i++;
    prefix = prefix.slice(0, i);
  }
  // Only cut at a word boundary, so "Error Logs - Details" vs "Error Logs - List"
  // becomes "Details" / "List" and never "s - Details".
  const sep = /[\s\-–—·:/|]/;
  const atBoundary = titles.every((t) => t.length === prefix.length || sep.test(t[prefix.length]));
  let lead = prefix;
  if (!atBoundary) {
    const cut = prefix.search(/[\s\-–—·:/|]+[^\s\-–—·:/|]*$/);
    lead = cut > 0 ? prefix.slice(0, cut) : "";
  }
  if (!lead) return titles;
  const rest = titles.map((t) => t.slice(lead.length).replace(/^[\s\-–—·:/|]+/, "").trim());
  return rest.every(Boolean) ? rest : titles;
}

/**
 * Tab labels for the delivery switcher. Titles first; when two deliveries
 * share a title (the common case for "Add delivery" on the same ticket), fall
 * back to their file names, and as a last resort suffix the delivery date.
 */
function deliveryLabels(
  deliveries: { title: string; variant: string; fileName: string; createdAt: Date }[]
): string[] {
  const unique = (xs: string[]) => new Set(xs).size === xs.length;
  const withVariant = deliveries.map((d) => (d.variant ? `${d.title} ${d.variant}` : d.title));
  if (unique(withVariant)) return distinctLabels(deliveries.map((d) => d.title));
  const byFile = distinctLabels(deliveries.map((d) => d.fileName));
  if (unique(byFile)) return byFile;
  return byFile.map((l, i) => `${l} · ${fmtDate(deliveries[i].createdAt)}`);
}

/**
 * Everything the page needs, in two round trips: the requested attachment,
 * then its revision chain and sibling deliveries side by side. Cached per
 * request so generateMetadata shares the lookup instead of querying again —
 * each round trip to the database is noticeable when switching deliveries.
 */
const loadPreview = cache(async (driveId: string) => {
  const requested = await prisma.designAttachment.findFirst({
    where: { path: driveId },
    include: { design: { include: { ticket: { include: { assignee: true } } } } },
  });
  if (!requested) return null;
  const [chain, deliveries] = await Promise.all([
    revisionChain(requested),
    siblingDeliveries(requested.design),
  ]);
  return { requested, chain, deliveries };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const loaded = await loadPreview(id);
  return { title: loaded?.requested.name ?? "Preview" };
}

export default async function AttachmentPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ exact?: string }>;
}) {
  const { id } = await params;
  const { exact } = await searchParams;

  const loaded = await loadPreview(id);
  if (!loaded) notFound();
  const { requested, chain, deliveries } = loaded;

  const newest = chain[chain.length - 1] ?? requested;
  // `?exact=1` pins the page to the version in the URL — used by the history
  // links below so an older design can still be opened deliberately.
  const shown = exact ? requested : newest;
  const isOutdatedLink = shown.id !== newest.id;
  const hasHistory = chain.length > 1;

  const design = requested.design;
  const owner = design.ticket?.assignee?.name ?? "Unassigned";
  const hasSiblings = deliveries.length > 1;
  const labels = deliveryLabels(deliveries);
  const tabs = deliveries.map((d, i) => ({
    id: d.id,
    href: `/preview/${d.path}`,
    label: labels[i],
    title: d.variant ? `${d.title} · ${d.variant}` : d.title,
    badge:
      d.variant && d.variant.toLowerCase() !== labels[i].toLowerCase() ? d.variant : undefined,
  }));

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Logo className="h-8 w-auto shrink-0" />
          <div className="min-w-0 leading-tight">
            <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-900">
              <span className="truncate">{design.title}</span>
              {hasHistory && (
                <span className="badge shrink-0 bg-brand-50 text-brand-700">
                  v{shown.version} of {newest.version}
                </span>
              )}
            </p>
            <p className="truncate text-xs text-slate-500">
              Owner: {owner} · Created: {fmtDate(design.createdAt)}
              {hasHistory && ` · This version: ${fmtDate(shown.createdAt)}`}
            </p>
          </div>
        </div>
        {hasSiblings && <DeliverySwitcher tabs={tabs} currentId={design.id} />}
        <div className="flex shrink-0 items-center gap-2">
          {hasHistory && (
            <details className="relative">
              <summary className="btn-secondary cursor-pointer list-none">
                <span>🕘</span> Versions ({chain.length})
              </summary>
              <div className="absolute right-0 z-10 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {[...chain].reverse().map((v) => {
                  const isShown = v.id === shown.id;
                  return (
                    <Link
                      key={v.id}
                      href={
                        v.id === newest.id
                          ? `/preview/${v.path}`
                          : `/preview/${v.path}?exact=1`
                      }
                      className={`flex items-baseline justify-between gap-2 px-3 py-2 text-sm transition hover:bg-slate-50 ${
                        isShown ? "font-semibold text-brand-700" : "text-slate-600"
                      }`}
                    >
                      <span>
                        v{v.version}
                        {v.id === newest.id && " · latest"}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {fmtDate(v.createdAt)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </details>
          )}
          <a
            href={`/api/files/${shown.path}?download=1`}
            download={shown.name}
            className="btn-secondary"
          >
            <span>⬇</span> Download {shown.kind === "html" ? "HTML file" : "file"}
          </a>
        </div>
      </header>

      {isOutdatedLink && (
        <p className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          You&apos;re viewing v{shown.version}, but v{newest.version} is the
          latest design.{" "}
          <Link href={`/preview/${newest.path}`} className="font-semibold underline">
            Open the latest version
          </Link>
        </p>
      )}

      <PreviewFrame key={shown.path} src={`/api/files/${shown.path}`} title={shown.name} />
    </div>
  );
}
