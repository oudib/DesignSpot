import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { prisma } from "@/lib/db";
import { tint, statusMeta, priorityMeta } from "@/lib/utils";
import { attachmentPreviewUrl } from "@/lib/attachmentUrl";

export const dynamic = "force-dynamic";

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


  return (
    <div className="min-h-screen">
      <SiteHeader />

      {/* Header band — same language as the solution page */}
      <section
        className="border-b border-slate-200/70"
        style={{ backgroundColor: tint(color, 0.06) }}
      >
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-800">
              Home
            </Link>
            <span className="text-slate-300">/</span>
            <Link
              href={`/solutions/${solution.slug}`}
              className="hover:text-slate-800"
            >
              {solution.name}
            </Link>
            <span className="text-slate-300">/</span>
            <span>{module.name}</span>
            <span className="text-slate-300">/</span>
            <span>{submodule.name}</span>
          </nav>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-sm"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${tint(
                    color,
                    0.18
                  )}, ${tint(color, 0.08)})`,
                  color,
                }}
              >
                {solution.icon}
              </div>
              <div>
                <span
                  className="badge mb-1"
                  style={{ backgroundColor: tint(color, 0.14), color }}
                >
                  Flow
                </span>
                <h1 className="text-3xl font-extrabold tracking-tight">
                  {flow.name}
                </h1>
                {flow.description && (
                  <p className="mt-1.5 max-w-2xl text-slate-600">
                    {flow.description}
                  </p>
                )}
              </div>
            </div>

            {(() => {
              const linked = flow.tickets.find((t) => t.linearUrl);
              return linked ? (
                <a
                  href={linked.linearUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary shrink-0"
                >
                  <span className="text-violet-600">◆</span> Open in Linear
                </a>
              ) : null;
            })()}
          </div>
        </div>
      </section>

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

            {flow.designs.length === 0 ? (
              <div className="card p-8 text-center text-slate-500">
                No designs linked yet. Add Claude design links from the{" "}
                <Link
                  href="/manage/structure"
                  className="text-brand-600 underline"
                >
                  workspace
                </Link>
                .
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {flow.designs.map((design, i) => (
                  <div
                    key={design.id}
                    className="animate-rise group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm"
                            style={{
                              backgroundImage: `linear-gradient(135deg, ${tint(
                                color,
                                0.18
                              )}, ${tint(color, 0.08)})`,
                              color,
                            }}
                          >
                            ◑
                          </span>
                          <p className="truncate font-semibold text-slate-800">
                            {design.title}
                          </p>
                        </div>
                        {design.variant && (
                          <span className="badge mt-2 bg-slate-100 text-slate-500">
                            {design.variant}
                          </span>
                        )}
                      </div>
                      {design.claudeUrl && (
                        <a
                          href={design.claudeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-sm font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100"
                        >
                          Open ↗
                        </a>
                      )}
                    </div>

                    {design.attachments.length > 0 && (
                      <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                        {design.attachments.map((att) => (
                          <li key={att.id}>
                            <a
                              href={att.kind === "html" ? attachmentPreviewUrl(att.url) : att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-600"
                            >
                              <span>{att.kind === "html" ? "◈" : "📎"}</span>
                              <span className="truncate">{att.name}</span>
                              {att.kind === "html" && (
                                <span className="badge shrink-0 bg-brand-50 text-brand-700">
                                  Preview standalone HTML
                                </span>
                              )}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
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
                      className="card flex items-start justify-between gap-4 p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">
                          {t.title}
                        </p>
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
                      {t.linearUrl && (
                        <a
                          href={t.linearUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary btn-sm shrink-0"
                        >
                          <span className="text-violet-600">◆</span> Linear ↗
                        </a>
                      )}
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
