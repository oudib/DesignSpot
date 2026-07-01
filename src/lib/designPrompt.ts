// Builds the "Generate a prompt" design brief handed to Claude from a ticket.
// Pure/string-only so it can be unit-reasoned about and reused server-side.

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

export function buildDesignPrompt(input: DesignPromptInput): string {
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

  const lines: string[] = [];

  lines.push(`# Design brief: ${title}`);
  lines.push("");
  lines.push(
    `You are a senior product designer. Produce a high-fidelity, production-ready UI design for **Sobrus ${solName}**${
      solution?.tagline ? ` — ${solution.tagline}` : ""
    }.`
  );
  lines.push("");

  // ---- Product context ----
  lines.push("## Product context");
  if (solution?.description) lines.push(`- **About ${solName}:** ${solution.description}`);
  if (location) lines.push(`- **Where this lives:** ${location}`);
  lines.push(
    `- **Interface language:** write every label, button, message and piece of placeholder content in ${lang}. Do not use lorem ipsum — use realistic content for a pharmacy / healthcare SaaS.`
  );
  lines.push("");

  // ---- What to design ----
  lines.push("## What to design");
  lines.push(`**${title}**`);
  if (description) {
    lines.push("");
    lines.push(description);
  }
  lines.push("");

  // ---- Linear metadata ----
  if (linear) {
    const meta: string[] = [];
    if (linear.identifier) meta.push(`Linear issue: ${linear.identifier}`);
    if (linear.state) meta.push(`Status: ${linear.state}`);
    if (linear.priorityLabel) meta.push(`Priority: ${linear.priorityLabel}`);
    if (linear.labels.length) meta.push(`Labels: ${linear.labels.join(", ")}`);
    if (meta.length) {
      lines.push(`> ${meta.join(" · ")}`);
      lines.push("");
    }
  }

  // ---- Brand & visual rules ----
  lines.push("## Brand & visual rules");
  lines.push(
    `- **Primary brand color: \`${accent}\`.** Use it for primary actions, active/selected states, links, focus rings and key highlights. Derive lighter tints for backgrounds/hover and darker shades for pressed states from this same hue — do not introduce unrelated accent colors.`
  );
  lines.push(
    "- Build on a neutral foundation: white/very-light surfaces, slate-gray text and borders, so the brand color stands out."
  );
  lines.push(
    "- Ensure all text meets **WCAG AA** contrast against its background; never put the brand color as text on a saturated background of the same hue."
  );
  lines.push(
    "- Use a consistent spacing scale (4 / 8 px rhythm), generous whitespace, rounded corners and subtle shadows for elevation."
  );
  lines.push(
    "- Establish a clear typographic hierarchy (page title → section → body → caption) with a clean sans-serif."
  );
  lines.push(
    "- Keep components consistent with a modern SaaS dashboard: well-defined buttons, inputs, tables, cards, badges and modals."
  );
  lines.push("");

  // ---- Deliverable rules ----
  lines.push("## Deliverable rules");
  lines.push(
    "- Design the complete screen/flow described above, desktop-first but responsive down to mobile."
  );
  lines.push(
    "- Show the relevant UI states: default, hover/focus, loading, empty and error."
  );
  lines.push(
    "- Make it an interactive, clickable prototype where that helps demonstrate the flow."
  );
  lines.push("- Prioritize clarity, usability, accessibility and visual polish.");
  lines.push(
    "- Annotate any non-obvious interactions or business rules briefly so the intent is clear."
  );
  lines.push("");

  // ---- Optional extras (filled in by the designer before sending) ----
  lines.push("---");
  lines.push("");
  lines.push("**Extra informations (optional):**");
  lines.push(
    "Add any extra details, constraints or specific changes here. If a screenshot of the current screen is attached, treat it as the UI we have today — use it as the starting point and apply the requested changes on top of it, keeping everything that isn't mentioned."
  );

  return lines.join("\n");
}
