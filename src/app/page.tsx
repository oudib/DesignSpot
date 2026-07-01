import SiteHeader from "@/components/SiteHeader";
import SolutionCard from "@/components/SolutionCard";
import HomeSearch from "@/components/HomeSearch";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const solutions = await prisma.solution.findMany({
    orderBy: { order: "asc" },
    include: {
      modules: {
        include: {
          submodules: {
            include: {
              flows: { include: { _count: { select: { designs: true } } } },
            },
          },
        },
      },
    },
  });

  const cards = solutions.map((s) => {
    let flows = 0;
    let designs = 0;
    for (const m of s.modules) {
      for (const sub of m.submodules) {
        flows += sub.flows.length;
        for (const f of sub.flows) designs += f._count.designs;
      }
    }
    return {
      solution: s,
      stats: { modules: s.modules.length, flows, designs },
    };
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        {/* Onboarding-style intro — compact, straight to the point */}
        <div className="animate-rise relative z-30 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Sobrus Design Hub
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Pick a solution to get started
          </h1>
          <p className="mt-2 text-base text-slate-500">
            Choose a product to explore its modules, flows and Claude designs.
          </p>

          <div className="mt-6">
            <HomeSearch />
          </div>
        </div>

        {/* Solutions grid */}
        {cards.length === 0 ? (
          <div className="card mt-10 p-10 text-center text-slate-500">
            No solutions yet. Run{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">
              npm run db:seed
            </code>
            .
          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ solution, stats }, i) => (
              <SolutionCard
                key={solution.id}
                solution={solution}
                stats={stats}
                index={i}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
