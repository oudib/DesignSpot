import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import Logo from "@/components/Logo";

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
async function revisionChain(driveId: string) {
  const requested = await prisma.designAttachment.findFirst({
    where: { path: driveId },
    include: { design: { include: { ticket: { include: { assignee: true } } } } },
  });
  if (!requested) return null;

  const rootId = requested.rootId ?? requested.id;
  const chain = await prisma.designAttachment.findMany({
    where: { OR: [{ id: rootId }, { rootId }] },
    orderBy: { version: "asc" },
  });
  return { requested, chain };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const attachment = await prisma.designAttachment.findFirst({
    where: { path: id },
  });
  return { title: attachment?.name ?? "Preview" };
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

  const resolved = await revisionChain(id);
  if (!resolved) notFound();
  const { requested, chain } = resolved;

  const newest = chain[chain.length - 1] ?? requested;
  // `?exact=1` pins the page to the version in the URL — used by the history
  // links below so an older design can still be opened deliberately.
  const shown = exact ? requested : newest;
  const isOutdatedLink = shown.id !== newest.id;
  const hasHistory = chain.length > 1;

  const design = requested.design;
  const owner = design.ticket?.assignee?.name ?? "Unassigned";

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

      <iframe
        src={`/api/files/${shown.path}`}
        title={shown.name}
        sandbox="allow-scripts allow-popups"
        className="min-h-0 flex-1 border-0"
      />
    </div>
  );
}
