import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SolutionExplorer from "@/components/SolutionExplorer";
import DarkHero from "@/components/DarkHero";
import { prisma } from "@/lib/db";
import { languageMeta } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const solution = await prisma.solution.findUnique({
    where: { slug },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          submodules: {
            orderBy: { order: "asc" },
            include: {
              flows: {
                orderBy: { order: "asc" },
                include: {
                  _count: { select: { designs: true, linearTickets: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!solution) notFound();

  const modules = solution.modules.map((m) => ({
    id: m.id,
    name: m.name,
    submodules: m.submodules.map((s) => ({
      id: s.id,
      name: s.name,
      flows: s.flows.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        linearCount: f._count.linearTickets,
        designs: f._count.designs,
      })),
    })),
  }));

  const totalFlows = solution.modules.reduce(
    (a, m) => a + m.submodules.reduce((b, s) => b + s.flows.length, 0),
    0
  );
  const totalDesigns = solution.modules.reduce(
    (a, m) =>
      a +
      m.submodules.reduce(
        (b, s) => b + s.flows.reduce((c, f) => c + f._count.designs, 0),
        0
      ),
    0
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <DarkHero
        accent={solution.color}
        className="rounded-b-[2rem] sm:rounded-b-[2.75rem]"
      >
        <div className="mx-auto max-w-5xl px-4 pb-12 pt-8 sm:px-6">
          <Link
            href="/"
            className="text-sm font-medium text-slate-400 transition hover:text-white"
          >
            ← All solutions
          </Link>
          <div className="mt-5 flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-3xl ring-1 ring-inset ring-white/15 backdrop-blur">
              {solution.icon}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {solution.name}
                </h1>
                <span
                  className={`badge ${languageMeta(solution.language).color}`}
                  title="Default UI language"
                >
                  {languageMeta(solution.language).label}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-300">
                {solution.tagline}
              </p>
              <p className="mt-2 max-w-2xl text-slate-400">
                {solution.description}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <HeroChip value={solution.modules.length} label="modules" />
                <HeroChip value={totalFlows} label="flows" />
                <HeroChip value={totalDesigns} label="designs" />
              </div>
            </div>
          </div>
        </div>
      </DarkHero>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <SolutionExplorer
          solution={{
            slug: solution.slug,
            name: solution.name,
            color: solution.color,
          }}
          modules={modules}
        />
      </main>
    </div>
  );
}

function HeroChip({ value, label }: { value: number; label: string }) {
  return (
    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-300 ring-1 ring-inset ring-white/10 backdrop-blur">
      <strong className="font-bold text-white">{value}</strong> {label}
    </span>
  );
}
