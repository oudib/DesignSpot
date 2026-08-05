import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import DarkHero from "@/components/DarkHero";
import { prisma } from "@/lib/db";
import { tint, statusMeta, priorityMeta } from "@/lib/utils";
import { currentActor, currentRole } from "@/lib/access";
import { hasWorkspaceAccess } from "@/lib/auth";
import FlowDesignsPanel from "@/components/FlowDesignsPanel";

export const dynamic = "force-dynamic";

/** Shared pill styling for the hero's action buttons. */
const heroBtn =
  "inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function FlowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const flow = await prisma.flow.findUnique({
    where: { id },
    include: {
      designs: {
        orderBy: { order: "asc" },
        include: { attachments: { orderBy: { createdAt: "asc" } } },
      },
      submodule: { include: { module: { include: { solution: true } } } },
      tickets: {
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
        include: { assignee: true },
      },
    },
  });

  if (!flow) notFound();

  const { submodule } = flow;
  const { module } = submodule;
  const { solution } = module;
  const color = solution.color;

  // Unique designers involved, from the linked tickets' assignees.
  const designers = Array.from(
    new Map(
      flow.tickets
        .filter((t) => t.assignee)
        .map((t) => [t.assignee!.id, t.assignee!])
    ).values()
  );

  // Only an admin, or a designer already responsible for this flow (assignee
  // on at least one of its tickets), gets edit/delete controls here.
  const actor = await currentActor();
  const canManage =
    !!actor &&
    (actor.isAdmin || designers.some((d) => d.id === actor.userId));
  // The workspace link is only worth showing to someone /manage would let in —
  // viewers get redirected home by its layout.
  const canEdit = canManage && hasWorkspaceAccess(await currentRole());

  // Tickets come back highest-priority first, so the leading one is the flow's
  // live work item. Editing happens on its ticket page; with no ticket to land
  // on there's still the flow's own row in the structure tree.
  const linkedTicket = flow.tickets.find((t) => t.linearUrl) ?? flow.tickets[0];
  const editHref = linkedTicket
    ? `/manage/tickets/${linkedTicket.id}`
    : `/manage/structure?flow=${flow.id}`;


  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Header band — same dark hero language as the home and solution pages */}
      <DarkHero
        accent={color}
        className="rounded-b-[2rem] sm:rounded-b-[2.75rem]"
      >
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6">
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-slate-400">
            <Link href="/" className="transition hover:text-white">
              Home
            </Link>
            <span className="text-slate-600">/</span>
            <Link
              href={`/solutions/${solution.slug}`}
              className="transition hover:text-white"
            >
              {solution.name}
            </Link>
            <span className="text-slate-600">/</span>
            <span>{module.name}</span>
            <span className="text-slate-600">/</span>
            <span>{submodule.name}</span>
          </nav>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-3xl ring-1 ring-inset ring-white/15 backdrop-blur">
                {solution.icon}
              </div>
              <div>
                <span className="badge mb-1.5 bg-white/10 text-slate-200 ring-1 ring-inset ring-white/10">
                  Flow
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {flow.name}
                </h1>
                {flow.description && (
                  <p className="mt-1.5 max-w-2xl text-slate-400">
                    {flow.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {linkedTicket?.linearUrl && (
                <a
                  href={linkedTicket.linearUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={heroBtn}
                >
                  <span className="text-violet-300">◆</span> Open in Linear
                </a>
              )}
              {canEdit && (
                <Link href={editHref} className={heroBtn}>
                  <span className="text-brand-300">✎</span> Edit in workspace
                </Link>
              )}
            </div>
          </div>
        </div>
      </DarkHero>

      {/* Main grid: content + details sidebar */}
      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          {/* Designs */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">
                Designs
                <span className="ml-2 text-sm font-normal text-slate-400">
                  {flow.designs.length} Claude links
                </span>
              </h2>
            </div>

            <FlowDesignsPanel
              designs={flow.designs}
              color={color}
              canManage={canManage}
            />
          </section>

          {/* Tickets — work items, each with its attached Linear link */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">
                Tickets
                <span className="ml-2 text-sm font-normal text-slate-400">
                  {flow.tickets.length} linked
                </span>
              </h2>
              <Link
                href="/manage/tickets"
                className="text-sm font-semibold text-brand-600 hover:underline"
              >
                Manage →
              </Link>
            </div>

            {flow.tickets.length === 0 ? (
              <div className="card p-8 text-center text-slate-500">
                No tickets linked to this flow yet.
              </div>
            ) : (
              <div className="space-y-3">
                {flow.tickets.map((t) => {
                  const sm = statusMeta(t.status);
                  const pm = priorityMeta(t.priority);
                  return (
                    <div
                      key={t.id}
                      className="card flex flex-col gap-4 p-5 transition hover:border-slate-300 hover:shadow-card-hover sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/manage/tickets/${t.id}`}
                          className="truncate font-semibold text-slate-800 hover:text-brand-600"
                        >
                          {t.title}
                        </Link>
                        {t.description && (
                          <p className="mt-0.5 truncate text-sm text-slate-400">
                            {t.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className={`badge ${sm.color}`}>{sm.label}</span>
                          <span className={`badge ${pm.color}`}>{pm.label}</span>
                          {t.assignee && (
                            <span className="badge bg-slate-100 text-slate-600">
                              {t.assignee.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {canManage && (
                          <Link
                            href={`/manage/tickets/${t.id}`}
                            className="btn-secondary flex-1 sm:flex-none"
                          >
                            Edit
                          </Link>
                        )}
                        {t.linearUrl && (
                          <a
                            href={t.linearUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary flex-1 sm:flex-none"
                          >
                            <span className="text-violet-600">◆</span> Linear ↗
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Details sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <div className="card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Details
            </h3>
            <dl className="mt-4 space-y-3.5 text-sm">
              <Row label="Solution">
                <Link
                  href={`/solutions/${solution.slug}`}
                  className="flex items-center gap-2 font-semibold text-slate-800 hover:text-brand-600"
                >
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-md text-xs"
                    style={{ backgroundColor: tint(color, 0.16), color }}
                  >
                    {solution.icon}
                  </span>
                  {solution.name}
                </Link>
              </Row>
              <Row label="Module">
                <span className="font-medium text-slate-700">{module.name}</span>
              </Row>
              <Row label="Submodule">
                <span className="font-medium text-slate-700">
                  {submodule.name}
                </span>
              </Row>
              <Row label="Designs">
                <span className="font-medium text-slate-700">
                  {flow.designs.length}
                </span>
              </Row>
              <Row label="Tickets">
                <span className="font-medium text-slate-700">
                  {flow.tickets.length}
                </span>
              </Row>
              <Row label="Updated">
                <span className="text-slate-500">{fmtDate(flow.updatedAt)}</span>
              </Row>
              <Row label="Created">
                <span className="text-slate-500">{fmtDate(flow.createdAt)}</span>
              </Row>
            </dl>
          </div>

          {/* Designers */}
          <div className="card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Designers
            </h3>
            {designers.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">
                No designers assigned yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {designers.map((d) => (
                  <li key={d.id} className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {initials(d.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {d.name}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {d.email}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
