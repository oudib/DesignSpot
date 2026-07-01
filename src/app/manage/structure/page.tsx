import { prisma } from "@/lib/db";
import StructureClient from "@/components/StructureClient";

export const dynamic = "force-dynamic";

export default async function StructurePage() {
  const solutions = await prisma.solution.findMany({
    orderBy: { order: "asc" },
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
                  designs: {
                    orderBy: { order: "asc" },
                    include: { attachments: { orderBy: { createdAt: "asc" } } },
                  },
                  linearTickets: { orderBy: { date: "desc" } },
                },
              },
            },
          },
        },
      },
    },
  });

  const data = solutions.map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    tagline: s.tagline,
    description: s.description,
    color: s.color,
    icon: s.icon,
    language: s.language,
    modules: s.modules.map((m) => ({
      id: m.id,
      name: m.name,
      submodules: m.submodules.map((sub) => ({
        id: sub.id,
        name: sub.name,
        flows: sub.flows.map((f) => ({
          id: f.id,
          name: f.name,
          description: f.description,
          designs: f.designs.map((d) => ({
            id: d.id,
            title: d.title,
            claudeUrl: d.claudeUrl,
            variant: d.variant,
            attachments: d.attachments.map((a) => ({
              id: a.id,
              name: a.name,
              url: a.url,
              mimeType: a.mimeType,
              size: a.size,
              kind: a.kind,
            })),
          })),
          linearTickets: f.linearTickets.map((lt) => ({
            id: lt.id,
            url: lt.url,
            label: lt.label,
            date: lt.date.toISOString().slice(0, 10),
          })),
        })),
      })),
    })),
  }));

  return <StructureClient solutions={data} />;
}
