import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SOLUTIONS = [
  {
    name: "Sobrus Pharma",
    slug: "sobrus-pharma",
    tagline: "Pharmacy management",
    description:
      "All-in-one management software for pharmacies — sales, stock, accounting and patient care.",
    color: "#1f47eb",
    icon: "💊",
  },
  {
    name: "Ecopara",
    slug: "ecopara",
    tagline: "Parapharmacy e-commerce",
    description:
      "Online parapharmacy marketplace connecting customers with trusted products.",
    color: "#0ea5a3",
    icon: "🌿",
  },
  {
    name: "Sobrus Supply",
    slug: "sobrus-supply",
    tagline: "Distribution & supply chain",
    description:
      "B2B ordering and supply platform linking pharmacies with wholesalers and labs.",
    color: "#f97316",
    icon: "📦",
  },
  {
    name: "Sobrus Club",
    slug: "sobrus-club",
    tagline: "Loyalty & community",
    description:
      "Loyalty program and community hub rewarding engagement across the Sobrus ecosystem.",
    color: "#a855f7",
    icon: "🎁",
  },
  {
    name: "Sobrus Meds",
    slug: "sobrus-meds",
    tagline: "Medical & prescriptions",
    description:
      "Digital tools for doctors and patients — e-prescriptions, records and teleconsultation.",
    color: "#e11d48",
    icon: "🩺",
  },
  {
    name: "Sobrus Design",
    slug: "sobrus-design",
    tagline: "Design system & brand",
    description:
      "The shared design system, components and brand guidelines powering every Sobrus product.",
    color: "#0f172a",
    icon: "🎨",
  },
];

// A small sample structure for Sobrus Pharma so the app is not empty on first run.
const SAMPLE_STRUCTURE = {
  solutionSlug: "sobrus-pharma",
  modules: [
    {
      name: "Sales",
      slug: "sales",
      submodules: [
        {
          name: "Point of Sale",
          slug: "point-of-sale",
          flows: [
            {
              name: "New sale flow",
              description: "From scanning a product to printing the receipt.",
              linearTickets: [
                {
                  url: "https://linear.app/sobrus/issue/PHA-101",
                  label: "Initial design",
                  date: "2026-01-12",
                },
                {
                  url: "https://linear.app/sobrus/issue/PHA-188",
                  label: "Payment step redesign",
                  date: "2026-03-04",
                },
              ],
              designs: [
                {
                  title: "POS — main screen",
                  claudeUrl: "https://claude.ai/",
                  variant: "desktop",
                },
                {
                  title: "POS — payment modal",
                  claudeUrl: "https://claude.ai/",
                  variant: "v2",
                },
              ],
            },
            {
              name: "Refund flow",
              description: "Handling product returns and refunds.",
              linearTickets: [
                {
                  url: "https://linear.app/sobrus/issue/PHA-102",
                  label: "Initial design",
                  date: "2026-02-02",
                },
              ],
              designs: [
                { title: "Refund — confirmation", claudeUrl: "https://claude.ai/", variant: "" },
              ],
            },
          ],
        },
      ],
    },
    {
      name: "Stock",
      slug: "stock",
      submodules: [
        {
          name: "Inventory",
          slug: "inventory",
          flows: [
            {
              name: "Stock count flow",
              description: "Periodic inventory counting workflow.",
              linearTickets: [],
              designs: [],
            },
          ],
        },
      ],
    },
  ],
};

async function main() {
  console.log("🌱 Seeding Sobrus DS…");

  // --- Designer / admin account ---
  const password = await bcrypt.hash("sobrus123", 10);
  await prisma.user.upsert({
    where: { email: "designer@sobrus.com" },
    update: {},
    create: {
      email: "designer@sobrus.com",
      name: "Sobrus Designer",
      password,
      role: "admin",
    },
  });
  console.log("   ✓ User: designer@sobrus.com / sobrus123");

  // --- Solutions ---
  for (let i = 0; i < SOLUTIONS.length; i++) {
    const s = SOLUTIONS[i];
    await prisma.solution.upsert({
      where: { slug: s.slug },
      update: { ...s, order: i },
      create: { ...s, order: i },
    });
  }
  console.log(`   ✓ ${SOLUTIONS.length} solutions`);

  // --- Sample structure ---
  const solution = await prisma.solution.findUnique({
    where: { slug: SAMPLE_STRUCTURE.solutionSlug },
  });
  if (solution) {
    for (let m = 0; m < SAMPLE_STRUCTURE.modules.length; m++) {
      const mod = SAMPLE_STRUCTURE.modules[m];
      const moduleRow = await prisma.module.upsert({
        where: { solutionId_slug: { solutionId: solution.id, slug: mod.slug } },
        update: { name: mod.name, order: m },
        create: { name: mod.name, slug: mod.slug, order: m, solutionId: solution.id },
      });

      for (let sm = 0; sm < mod.submodules.length; sm++) {
        const sub = mod.submodules[sm];
        const subRow = await prisma.submodule.upsert({
          where: { moduleId_slug: { moduleId: moduleRow.id, slug: sub.slug } },
          update: { name: sub.name, order: sm },
          create: { name: sub.name, slug: sub.slug, order: sm, moduleId: moduleRow.id },
        });

        for (let f = 0; f < sub.flows.length; f++) {
          const flow = sub.flows[f];
          // Flows have no natural unique key in the sample; recreate cleanly.
          const existing = await prisma.flow.findFirst({
            where: { submoduleId: subRow.id, name: flow.name },
          });
          const flowRow = existing
            ? await prisma.flow.update({
                where: { id: existing.id },
                data: { description: flow.description, order: f },
              })
            : await prisma.flow.create({
                data: {
                  name: flow.name,
                  description: flow.description,
                  order: f,
                  submoduleId: subRow.id,
                },
              });

          for (const lt of flow.linearTickets) {
            const existingLt = await prisma.linearTicket.findFirst({
              where: { flowId: flowRow.id, url: lt.url },
            });
            if (!existingLt) {
              await prisma.linearTicket.create({
                data: {
                  url: lt.url,
                  label: lt.label,
                  date: new Date(lt.date),
                  flowId: flowRow.id,
                },
              });
            }
          }

          for (let d = 0; d < flow.designs.length; d++) {
            const design = flow.designs[d];
            const existingDesign = await prisma.design.findFirst({
              where: { flowId: flowRow.id, title: design.title },
            });
            if (!existingDesign) {
              await prisma.design.create({
                data: {
                  title: design.title,
                  claudeUrl: design.claudeUrl,
                  variant: design.variant,
                  order: d,
                  flowId: flowRow.id,
                },
              });
            }
          }
        }
      }
    }
    console.log("   ✓ Sample structure for Sobrus Pharma");
  }

  console.log("✅ Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
