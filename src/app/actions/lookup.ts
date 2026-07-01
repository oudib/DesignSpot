"use server";

import { prisma } from "@/lib/db";

// Public lookups used by the home-page search and the "Find by Linear"
// navbar popup. No auth — these only ever return public hierarchy info.

export type SearchResult = {
  type: "solution" | "module" | "submodule" | "flow" | "ticket";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

/**
 * Search the hierarchy by name (solutions, flows) or by ticket ID / title.
 * Returns a small, ranked-enough list ready to render in a dropdown.
 */
export async function searchEverything(raw: string): Promise<SearchResult[]> {
  const query = raw.trim();
  if (query.length < 2) return [];

  const contains = { contains: query, mode: "insensitive" as const };

  const [solutions, modules, submodules, flows, tickets] = await Promise.all([
    prisma.solution.findMany({
      where: { OR: [{ name: contains }, { tagline: contains }] },
      take: 5,
      orderBy: { order: "asc" },
    }),
    prisma.module.findMany({
      where: { name: contains },
      take: 5,
      include: { solution: true },
    }),
    prisma.submodule.findMany({
      where: { name: contains },
      take: 5,
      include: { module: { include: { solution: true } } },
    }),
    prisma.flow.findMany({
      where: { OR: [{ name: contains }, { description: contains }] },
      take: 6,
      include: {
        submodule: { include: { module: { include: { solution: true } } } },
      },
    }),
    prisma.ticket.findMany({
      where: { OR: [{ id: query }, { title: contains }] },
      take: 6,
      include: {
        flow: true,
        solution: true,
      },
    }),
  ]);

  const results: SearchResult[] = [];

  for (const s of solutions) {
    results.push({
      type: "solution",
      id: s.id,
      title: s.name,
      subtitle: s.tagline || "Solution",
      href: `/solutions/${s.slug}`,
    });
  }

  for (const m of modules) {
    results.push({
      type: "module",
      id: m.id,
      title: m.name,
      subtitle: `${m.solution.name} › Module`,
      href: `/solutions/${m.solution.slug}`,
    });
  }

  for (const sm of submodules) {
    results.push({
      type: "submodule",
      id: sm.id,
      title: sm.name,
      subtitle: `${sm.module.solution.name} › ${sm.module.name}`,
      href: `/solutions/${sm.module.solution.slug}`,
    });
  }

  for (const f of flows) {
    const sol = f.submodule.module.solution;
    results.push({
      type: "flow",
      id: f.id,
      title: f.name,
      subtitle: `${sol.name} › ${f.submodule.module.name} › ${f.submodule.name}`,
      href: `/flows/${f.id}`,
    });
  }

  for (const t of tickets) {
    const href = t.flowId
      ? `/flows/${t.flowId}`
      : t.solution
        ? `/solutions/${t.solution.slug}`
        : "/manage/tickets";
    results.push({
      type: "ticket",
      id: t.id,
      title: t.title,
      subtitle: t.flow
        ? `Ticket · ${t.flow.name}`
        : t.solution
          ? `Ticket · ${t.solution.name}`
          : "Ticket",
      href,
    });
  }

  return results;
}

export type LinearLookup =
  | { ok: true; flowId: string; flowName: string }
  | { ok: false; error: string };

/**
 * Resolve a pasted Linear ticket link to the flow it's attached to.
 * Matches on the exact URL or the Linear issue identifier (e.g. SOB-123)
 * extracted from it, against both LinearTickets and tickets' linearUrl.
 */
export async function findByLinear(rawUrl: string): Promise<LinearLookup> {
  const url = rawUrl.trim();
  if (!url) {
    return { ok: false, error: "Please paste a Linear ticket link." };
  }
  if (!/linear\.app/i.test(url)) {
    return {
      ok: false,
      error: "That doesn't look like a Linear link (expected linear.app/…).",
    };
  }

  // Linear issue URLs look like .../issue/SOB-123/some-slug
  const idMatch = url.match(/\/issue\/([A-Za-z][A-Za-z0-9]*-\d+)/i);
  const issueId = idMatch ? idMatch[1].toUpperCase() : null;

  const urlContains = { contains: url };
  const idContains = issueId
    ? { contains: issueId, mode: "insensitive" as const }
    : null;

  // First try the dated LinearTickets attached directly to flows.
  const linearTicket = await prisma.linearTicket.findFirst({
    where: {
      OR: [
        { url: urlContains },
        ...(idContains ? [{ url: idContains }] : []),
      ],
    },
    include: { flow: true },
  });

  if (linearTicket) {
    return {
      ok: true,
      flowId: linearTicket.flowId,
      flowName: linearTicket.flow.name,
    };
  }

  // Fall back to work tickets that carry a Linear URL and link to a flow.
  const ticket = await prisma.ticket.findFirst({
    where: {
      flowId: { not: null },
      OR: [
        { linearUrl: urlContains },
        ...(idContains ? [{ linearUrl: idContains }] : []),
      ],
    },
    include: { flow: true },
  });

  if (ticket?.flow) {
    return { ok: true, flowId: ticket.flow.id, flowName: ticket.flow.name };
  }

  return {
    ok: false,
    error: "No flow is linked to that Linear ticket yet.",
  };
}
