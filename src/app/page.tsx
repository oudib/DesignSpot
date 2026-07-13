import HomeHero from "@/components/HomeHero";
import SolutionCard from "@/components/SolutionCard";
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
      <HomeHero
        solutions={solutions.map((s) => ({ name: s.name, slug: s.slug }))}
      />

      {/* Cards float up over the navy hero, Payfin-style */}
      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        {cards.length === 0 ? (
          <div className="card -mt-16 p-10 text-center text-slate-500 sm:-mt-20">
            No solutions yet. Run{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">
              npm run db:seed
            </code>
            .
          </div>
        ) : (
          <div className="-mt-16 grid gap-5 sm:-mt-20 sm:grid-cols-2 lg:grid-cols-3">
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
