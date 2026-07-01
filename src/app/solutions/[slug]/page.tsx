import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import SolutionExplorer from "@/components/SolutionExplorer";
import { prisma } from "@/lib/db";
import { tint, languageMeta } from "@/lib/utils";

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

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <section
        className="border-b border-slate-200/70"
        style={{ backgroundColor: tint(solution.color, 0.06) }}
      >
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <Link
            href="/"
            className="text-sm font-medium text-slate-500 transition hover:text-slate-800"
          >
            ← All solutions
          </Link>
          <div className="mt-4 flex items-start gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-sm"
              style={{
                backgroundImage: `linear-gradient(135deg, ${tint(
                  solution.color,
                  0.18
                )}, ${tint(solution.color, 0.08)})`,
                color: solution.color,
              }}
            >
              {solution.icon}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-extrabold tracking-tight">
                  {solution.name}
                </h1>
                <span
                  className={`badge ${languageMeta(solution.language).color}`}
                  title="Default UI language"
                >
                  {languageMeta(solution.language).label}
                </span>
              </div>
              <p
                className="text-sm font-semibold"
                style={{ color: solution.color }}
              >
                {solution.tagline}
              </p>
              <p className="mt-2 max-w-2xl text-slate-600">
                {solution.description}
              </p>
            </div>
          </div>
        </div>
      </section>

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
