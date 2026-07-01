import { PrismaClient } from "@prisma/client";

// Adds the "Sobrus Central" solution and its full module / submodule tree.
// Built from the Sobrus Central navigation (top nav + the "Plus" dropdown).
// Idempotent: safe to re-run (uses upserts keyed by slug).

const prisma = new PrismaClient();

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const SOLUTION = {
  name: "Sobrus Central",
  slug: "sobrus-central",
  tagline: "Internal company platform",
  description:
    "The central back-office connecting every Sobrus solution — CRM, billing, HR, marketplace and platform administration in one place.",
  color: "#14b8a6",
  icon: "🧭",
  language: "en",
};

// Order follows the navigation: top-nav modules first, then everything in
// the "Plus" dropdown. Submodules are listed under their module.
const MODULES: { name: string; submodules: string[] }[] = [
  // --- Top navigation ---
  { name: "Sobrus Club", submodules: [] },
  { name: "Suppliers", submodules: [] },
  { name: "Marketing", submodules: [] },
  { name: "Products", submodules: [] },
  { name: "Customers", submodules: [] },
  { name: "Contacts", submodules: [] },
  { name: "Planning", submodules: [] },
  // --- "Plus" dropdown ---
  { name: "Lead Management", submodules: [] },
  { name: "Opportunities", submodules: [] },
  { name: "Resources", submodules: ["Hardware"] },
  {
    name: "HR",
    submodules: [
      "Hiring requests",
      "Job Posting",
      "Applications",
      "Employees",
      "Documents",
      "Time Off",
      "Time Off Requests",
      "Balances",
    ],
  },
  {
    name: "Billing",
    submodules: [
      "Quote",
      "Delivery Note",
      "Delivery Notes Payments",
      "Online Payments",
      "Ecopara Payments",
      "Ecopara Transfer Orders",
      "Invoices",
      "Customer Credits",
      "Communications Refills",
      "Posts Refills",
      "Items",
      "Series",
    ],
  },
  { name: "Events", submodules: [] },
  { name: "Tenants", submodules: [] },
  { name: "Users", submodules: [] },
  { name: "Policies", submodules: [] },
  { name: "Testimonies", submodules: [] },
  { name: "Articles", submodules: [] },
  { name: "Call Recording", submodules: [] },
  { name: "Help Center", submodules: [] },
  { name: "Administrative Docs", submodules: [] },
  { name: "SuperApp", submodules: ["Sales Channels"] },
  { name: "MarketPlace", submodules: ["Offers", "Orders", "Stores"] },
  { name: "Ecopara", submodules: ["Patient"] },
  { name: "MonPharmacien", submodules: ["Patient"] },
  { name: "Healthcare establishments", submodules: ["Suggestions"] },
  { name: "Doctors", submodules: ["Suggestions"] },
  { name: "Pharmacies", submodules: ["Suggestions"] },
  { name: "Pharmacists", submodules: ["Suggestions"] },
  { name: "Payers", submodules: ["Product information"] },
  { name: "Associations", submodules: ["Suggestions"] },
  { name: "Sobrus projects", submodules: [] },
  { name: "Landing page", submodules: ["Satisfaction surveys", "Answers"] },
  { name: "Releases", submodules: [] },
  { name: "Master Customers", submodules: [] },
  { name: "Reports", submodules: [] },
  { name: "Settings", submodules: [] },
];

async function main() {
  console.log("🧭 Adding Sobrus Central…");

  // Place it after the existing solutions.
  const count = await prisma.solution.count();
  const existing = await prisma.solution.findUnique({
    where: { slug: SOLUTION.slug },
  });
  const order = existing?.order ?? count;

  const solution = await prisma.solution.upsert({
    where: { slug: SOLUTION.slug },
    update: { ...SOLUTION },
    create: { ...SOLUTION, order },
  });
  console.log(`   ✓ Solution: ${solution.name} (order ${order})`);

  for (let m = 0; m < MODULES.length; m++) {
    const mod = MODULES[m];
    const modSlug = slugify(mod.name);
    const moduleRow = await prisma.module.upsert({
      where: { solutionId_slug: { solutionId: solution.id, slug: modSlug } },
      update: { name: mod.name, order: m },
      create: { name: mod.name, slug: modSlug, order: m, solutionId: solution.id },
    });

    for (let sm = 0; sm < mod.submodules.length; sm++) {
      const subName = mod.submodules[sm];
      const subSlug = slugify(subName);
      await prisma.submodule.upsert({
        where: { moduleId_slug: { moduleId: moduleRow.id, slug: subSlug } },
        update: { name: subName, order: sm },
        create: { name: subName, slug: subSlug, order: sm, moduleId: moduleRow.id },
      });
    }
  }

  const totalSubs = MODULES.reduce((n, m) => n + m.submodules.length, 0);
  console.log(`   ✓ ${MODULES.length} modules, ${totalSubs} submodules`);
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
