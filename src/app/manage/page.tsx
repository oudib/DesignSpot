import Link from "next/link";
import { prisma } from "@/lib/db";
import { statusMeta, priorityMeta } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ManageOverview() {
  const [solutions, modules, flows, designs, tickets, recent] =
    await Promise.all([
      prisma.solution.count(),
      prisma.module.count(),
      prisma.flow.count(),
      prisma.design.count(),
      prisma.ticket.groupBy({ by: ["status"], _count: true }),
      prisma.ticket.findMany({
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: { assignee: true, solution: true },
      }),
    ]);

  const ticketByStatus = Object.fromEntries(
    tickets.map((t) => [t.status, t._count])
  );
  const totalTickets = tickets.reduce((a, t) => a + t._count, 0);

  const stats = [
    { label: "Solutions", value: solutions, href: "/manage/structure" },
    { label: "Modules", value: modules, href: "/manage/structure" },
    { label: "Flows", value: flows, href: "/manage/structure" },
    { label: "Designs", value: designs, href: "/manage/structure" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
      <p className="mt-1 text-slate-500">
        Manage your design structure and tickets across every Sobrus solution.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="card p-5 transition hover:shadow-card-hover"
          >
            <div className="text-3xl font-extrabold tracking-tight">
              {s.value}
            </div>
            <div className="mt-1 text-sm text-slate-500">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Tickets</h2>
            <Link
              href="/manage/tickets"
              className="text-sm font-semibold text-brand-600"
            >
              Manage →
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {["todo", "in_progress", "review", "done"].map((st) => {
              const meta = statusMeta(st);
              const count = ticketByStatus[st] ?? 0;
              const pct = totalTickets ? (count / totalTickets) * 100 : 0;
              return (
                <div key={st}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className={`badge ${meta.color}`}>{meta.label}</span>
                    <span className="font-semibold text-slate-700">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-6 lg:col-span-2">
          <h2 className="font-bold">Recent activity</h2>
          {recent.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No tickets yet.{" "}
              <Link href="/manage/tickets" className="text-brand-600 underline">
                Create one
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {recent.map((t) => {
                const meta = statusMeta(t.status);
                const pmeta = priorityMeta(t.priority);
                return (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">
                        {t.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {t.solution ? t.solution.name : "Unassigned"} ·{" "}
                        {t.assignee?.name ?? "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`badge ${pmeta.color}`}>
                        {pmeta.label}
                      </span>
                      <span className={`badge ${meta.color}`}>{meta.label}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
