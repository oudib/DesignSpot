export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Lighten/darken not needed — we derive a soft tint from a hex accent. */
export function tint(hex: string, alpha = 0.12): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 52;
  const g = parseInt(full.slice(2, 4), 16) || 100;
  const b = parseInt(full.slice(4, 6), 16) || 246;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const TICKET_STATUSES = [
  { value: "todo", label: "To do", color: "bg-slate-100 text-slate-700" },
  { value: "in_progress", label: "In progress", color: "bg-blue-100 text-blue-700" },
  { value: "review", label: "In review", color: "bg-amber-100 text-amber-700" },
  { value: "done", label: "Done", color: "bg-emerald-100 text-emerald-700" },
] as const;

export const TICKET_PRIORITIES = [
  { value: "low", label: "Low", color: "bg-slate-100 text-slate-600" },
  { value: "medium", label: "Medium", color: "bg-sky-100 text-sky-700" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-700" },
  { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-700" },
] as const;

export function statusMeta(value: string) {
  return TICKET_STATUSES.find((s) => s.value === value) ?? TICKET_STATUSES[0];
}
export function priorityMeta(value: string) {
  return TICKET_PRIORITIES.find((p) => p.value === value) ?? TICKET_PRIORITIES[1];
}

// Default UI interface language assigned to each solution.
export const SOLUTION_LANGUAGES = [
  { value: "en", label: "English", short: "EN", color: "bg-sky-100 text-sky-700" },
  { value: "fr", label: "French", short: "FR", color: "bg-indigo-100 text-indigo-700" },
  {
    value: "mixed",
    label: "Mixed (FR + EN)",
    short: "FR + EN",
    color: "bg-violet-100 text-violet-700",
  },
] as const;

export function languageMeta(value: string) {
  return (
    SOLUTION_LANGUAGES.find((l) => l.value === value) ?? SOLUTION_LANGUAGES[0]
  );
}

/* ------------------------- Flow-level permissions ------------------------ */
// A ticket/design can only be edited or deleted by an admin, or by a designer
// "responsible for the flow" — i.e. already the assignee of at least one
// other ticket on that same flow. Tickets with no flow (rare) fall back to
// just their own assignee, since there's no flow group to belong to.

export type Actor = { userId: string; isAdmin: boolean } | null;

/** Builds flowId -> set of assignee ids from an already-loaded ticket list, so
 * pages that fetch every ticket at once (the board) don't need N extra queries. */
export function buildFlowDesignerMap(
  tickets: { flowId: string | null; assigneeId: string | null }[]
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const t of tickets) {
    if (!t.flowId || !t.assigneeId) continue;
    if (!map.has(t.flowId)) map.set(t.flowId, new Set());
    map.get(t.flowId)!.add(t.assigneeId);
  }
  return map;
}

export function canManageWithMap(
  actor: Actor,
  flowId: string | null,
  assigneeId: string | null,
  designerMap: Map<string, Set<string>>
): boolean {
  if (!actor) return false;
  if (actor.isAdmin) return true;
  if (flowId) return designerMap.get(flowId)?.has(actor.userId) ?? false;
  return !!assigneeId && assigneeId === actor.userId;
}
