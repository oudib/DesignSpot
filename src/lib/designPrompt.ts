// Builds the "Generate a prompt" design brief handed to Claude from a ticket.
// The wording lives in an editable template (see DEFAULT_PROMPT_TEMPLATE)
// with {{placeholder}} tokens — a designer can have their own override,
// edited by an admin in /manage/prompt-builder (see PromptTemplate in
// prisma/schema.prisma). Pure/string-only so it can be unit-reasoned about
// and reused server-side.

import type { LinearIssue } from "@/lib/linear";

type SolutionLite = {
  name: string;
  tagline: string;
  description: string;
  color: string;
  language: string;
};

export type DesignPromptInput = {
  ticket: {
    title: string;
    description: string;
    priority: string;
    linearUrl: string;
  };
  solution: SolutionLite | null;
  path: {
    module: string | null;
    submodule: string | null;
    flow: string | null;
  };
  linear: LinearIssue | null;
};

function languageName(code: string): string {
  switch (code) {
    case "fr":
      return "French";
    case "en":
      return "English";
    case "mixed":
      return "French and English (mixed, French-leaning)";
    default:
      return code || "the product's default language";
  }
}

// Placeholders available to a prompt template. A few of these already carry
// their own bullet/blank-line formatting so a template can stay simple while
// still omitting a line cleanly when the underlying data is missing (e.g. a
// solution with no description, or a ticket with no linked Linear issue).
export type PromptVars = {
  title: string;
  solutionName: string;
  // " — tagline" if the solution has one, else "".
  taglineClause: string;
  // "- **About X:** …\n" if the solution has a description, else "".
  aboutBullet: string;
  // "- **Where this lives:** …\n" if there's a hierarchy path, else "".
  locationBullet: string;
  language: string;
  // "\n\n<description>" if the ticket/issue has one, else "".
  descriptionBlock: string;
  // "> Linear issue: … · Status: …\n\n" if a Linear issue is linked, else "".
  linearMetaBlock: string;
  accent: string;
};

export const PROMPT_PLACEHOLDERS: { key: keyof PromptVars; label: string }[] = [
  { key: "title", label: "Ticket / Linear issue title" },
  { key: "solutionName", label: "Product name, e.g. \"ERP\"" },
  { key: "taglineClause", label: "\" — tagline\", or empty if none" },
  { key: "aboutBullet", label: "\"- **About X:** …\" bullet, or empty if no description" },
  { key: "locationBullet", label: "\"- **Where this lives:** …\" bullet, or empty" },
  { key: "language", label: "Interface language, e.g. \"French\"" },
  { key: "descriptionBlock", label: "The ticket/issue description, or empty" },
  { key: "linearMetaBlock", label: "Linear status/priority/labels blockquote, or empty" },
  { key: "accent", label: "Product brand hex color" },
];

export const DEFAULT_PROMPT_TEMPLATE = `# Design brief: {{title}}

You are a senior product designer. Produce a high-fidelity, production-ready UI design for **Sobrus {{solutionName}}**{{taglineClause}}.

## Product context
{{aboutBullet}}{{locationBullet}}- **Interface language:** write every label, button, message and piece of placeholder content in {{language}}. Do not use lorem ipsum — use realistic content for a pharmacy / healthcare SaaS.

## What to design
**{{title}}**{{descriptionBlock}}

{{linearMetaBlock}}## Brand & visual rules
- **Primary brand color: \`{{accent}}\`.** Use it for primary actions, active/selected states, links, focus rings and key highlights. Derive lighter tints for backgrounds/hover and darker shades for pressed states from this same hue — do not introduce unrelated accent colors.
- Build on a neutral foundation: white/very-light surfaces, slate-gray text and borders, so the brand color stands out.
- Ensure all text meets **WCAG AA** contrast against its background; never put the brand color as text on a saturated background of the same hue.
- Use a consistent spacing scale (4 / 8 px rhythm), generous whitespace, rounded corners and subtle shadows for elevation.
- Establish a clear typographic hierarchy (page title → section → body → caption) with a clean sans-serif.
- Keep components consistent with a modern SaaS dashboard: well-defined buttons, inputs, tables, cards, badges and modals.
- Use icons exclusively from the **Phosphor Icons** set (not Lucide or any other icon library).

## Deliverable rules
- Design the complete screen/flow described above, desktop-first but responsive down to mobile.
- Show the relevant UI states: default, hover/focus, loading, empty and error.
- Make it an interactive, clickable prototype where that helps demonstrate the flow.
- Prioritize clarity, usability, accessibility and visual polish.
- Annotate any non-obvious interactions or business rules briefly so the intent is clear.

---

**Extra informations (optional):**
Add any extra details, constraints or specific changes here. If a screenshot of the current screen is attached, treat it as the UI we have today — use it as the starting point and apply the requested changes on top of it, keeping everything that isn't mentioned.`;

export function renderPromptTemplate(template: string, vars: PromptVars): string {
  return template.replace(/{{\s*(\w+)\s*}}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key)
      ? vars[key as keyof PromptVars]
      : match
  );
}

export function buildDesignPrompt(
  input: DesignPromptInput,
  template: string = DEFAULT_PROMPT_TEMPLATE
): string {
  const { ticket, solution, path, linear } = input;

  // Prefer the live Linear content; fall back to the local ticket fields.
  const title = linear?.title?.trim() || ticket.title;
  const description = (linear?.description?.trim() || ticket.description).trim();

  const solName = solution?.name ?? "Sobrus";
  const accent = solution?.color ?? "#3464f6";
  const lang = languageName(solution?.language ?? "en");

  const locationParts = [solName, path.module, path.submodule, path.flow].filter(
    Boolean
  );
  const location = locationParts.join(" › ");

  const meta: string[] = [];
  if (linear) {
    if (linear.identifier) meta.push(`Linear issue: ${linear.identifier}`);
    if (linear.state) meta.push(`Status: ${linear.state}`);
    if (linear.priorityLabel) meta.push(`Priority: ${linear.priorityLabel}`);
    if (linear.labels.length) meta.push(`Labels: ${linear.labels.join(", ")}`);
  }

  const vars: PromptVars = {
    title,
    solutionName: solName,
    taglineClause: solution?.tagline ? ` — ${solution.tagline}` : "",
    aboutBullet: solution?.description
      ? `- **About ${solName}:** ${solution.description}\n`
      : "",
    locationBullet: location ? `- **Where this lives:** ${location}\n` : "",
    language: lang,
    descriptionBlock: description ? `\n\n${description}` : "",
    linearMetaBlock: meta.length ? `> ${meta.join(" · ")}\n\n` : "",
    accent,
  };

  return renderPromptTemplate(template, vars);
}
