"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, destroySession, hasWorkspaceAccess } from "@/lib/auth";
import { canManageFlow } from "@/lib/access";
import { slugify } from "@/lib/utils";
import {
  postLinearComment,
  getLinearViewer,
  getLinearIssue,
  flowUrl,
  statusMessage,
} from "@/lib/linear";
import { buildDesignPrompt } from "@/lib/designPrompt";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { uploadAttachment, deleteAttachment, attachmentKind } from "@/lib/storage";

/* ------------------------- Linear sync helpers ------------------------ */
// Each designer connects their own Linear, so every push uses the ACTING
// designer's decrypted Personal API key (comments are authored as them). All
// of these are best-effort: postLinearComment no-ops when the key is null and
// never throws, so awaiting them is safe inside server actions.

/** Decrypted Linear key for the acting designer, or null if not connected. */
async function actingLinearKey(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { linearApiKey: true },
  });
  return decryptSecret(user?.linearApiKey);
}

async function linkFlowToLinear(
  apiKey: string | null,
  linearUrl: string,
  flowId: string
) {
  if (!apiKey || !linearUrl || !flowId) return;
  const flow = await prisma.flow.findUnique({ where: { id: flowId } });
  if (!flow) return;
  await postLinearComment(
    apiKey,
    linearUrl,
    `🔗 Linked design flow: **${flow.name}**\n${flowUrl(flowId)}`
  );
}

async function announceStatus(
  apiKey: string | null,
  linearUrl: string,
  status: string
) {
  if (!apiKey || !linearUrl) return;
  const msg = statusMessage(status);
  if (msg) await postLinearComment(apiKey, linearUrl, msg);
}

// Compare a ticket's previous state to its new state and push only the events
// that actually changed: a freshly-attached/changed Linear link or flow gets a
// flow-link comment; a status change gets a status comment.
async function syncTicketChanges(
  apiKey: string | null,
  prev: { linearUrl: string; flowId: string | null; status: string } | null,
  next: { linearUrl: string; flowId: string | null; status: string }
) {
  if (!apiKey || !next.linearUrl) return;
  const issueChanged = prev?.linearUrl !== next.linearUrl;
  const flowChanged = prev?.flowId !== next.flowId;
  if (next.flowId && (issueChanged || flowChanged)) {
    await linkFlowToLinear(apiKey, next.linearUrl, next.flowId);
  }
  if (issueChanged || prev?.status !== next.status) {
    await announceStatus(apiKey, next.linearUrl, next.status);
  }
}

async function requireAuth() {
  const session = await getSession();
  if (!session) redirect("/login?from=/manage");
  // Role comes from the DB, not the JWT, so revoking workspace access in
  // /manage/users locks mutations out immediately.
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  if (!hasWorkspaceAccess(user?.role)) redirect("/");
  return { userId: session.userId, isAdmin: user?.role === "admin" };
}

function s(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

/* ----------------------------- Auth ----------------------------- */

export async function logout() {
  await destroySession();
  redirect("/login");
}

/* ------------------------- Linear connection -------------------------- */
// Per-designer connect/disconnect for the settings page. The key is validated
// against Linear before saving and stored encrypted; it's never sent back to
// the browser.

export type ConnectResult = { ok: boolean; message: string };

export async function connectLinear(
  _prev: ConnectResult | null,
  fd: FormData
): Promise<ConnectResult> {
  const session = await requireAuth();
  const apiKey = s(fd, "apiKey");
  if (!apiKey) return { ok: false, message: "Paste your Linear API key first." };
  const viewer = await getLinearViewer(apiKey);
  if (!viewer) {
    return {
      ok: false,
      message: "That key didn't work — double-check it and try again.",
    };
  }
  await prisma.user.update({
    where: { id: session.userId },
    data: { linearApiKey: encryptSecret(apiKey) },
  });
  revalidatePath("/manage/settings");
  return { ok: true, message: `Connected as ${viewer.name} (${viewer.email}).` };
}

export async function disconnectLinear() {
  const session = await requireAuth();
  await prisma.user.update({
    where: { id: session.userId },
    data: { linearApiKey: null },
  });
  revalidatePath("/manage/settings");
}

/* --------------------------- Solutions -------------------------- */

export async function createSolution(fd: FormData) {
  await requireAuth();
  const name = s(fd, "name");
  if (!name) return;
  const slug = s(fd, "slug") || slugify(name);
  const count = await prisma.solution.count();
  await prisma.solution.create({
    data: {
      name,
      slug,
      tagline: s(fd, "tagline"),
      description: s(fd, "description"),
      color: s(fd, "color") || "#3464f6",
      icon: s(fd, "icon") || "✦",
      language: s(fd, "language") || "en",
      order: count,
    },
  });
  revalidateAll();
}

export async function updateSolution(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  await prisma.solution.update({
    where: { id },
    data: {
      name: s(fd, "name"),
      tagline: s(fd, "tagline"),
      description: s(fd, "description"),
      color: s(fd, "color") || "#3464f6",
      icon: s(fd, "icon") || "✦",
      language: s(fd, "language") || "en",
    },
  });
  revalidateAll();
}

export async function deleteSolution(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (id) await prisma.solution.delete({ where: { id } });
  revalidateAll();
}

/* ---------------------------- Modules --------------------------- */

export async function createModule(fd: FormData) {
  await requireAuth();
  const name = s(fd, "name");
  const solutionId = s(fd, "solutionId");
  if (!name || !solutionId) return;
  const count = await prisma.module.count({ where: { solutionId } });
  await prisma.module.create({
    data: { name, slug: slugify(name) || `m-${count}`, solutionId, order: count },
  });
  revalidateAll();
}

export async function updateModule(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  await prisma.module.update({ where: { id }, data: { name: s(fd, "name") } });
  revalidateAll();
}

export async function deleteModule(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (id) await prisma.module.delete({ where: { id } });
  revalidateAll();
}

/* -------------------------- Submodules -------------------------- */

export async function createSubmodule(fd: FormData) {
  await requireAuth();
  const name = s(fd, "name");
  const moduleId = s(fd, "moduleId");
  if (!name || !moduleId) return;
  const count = await prisma.submodule.count({ where: { moduleId } });
  await prisma.submodule.create({
    data: { name, slug: slugify(name) || `sm-${count}`, moduleId, order: count },
  });
  revalidateAll();
}

export async function updateSubmodule(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  await prisma.submodule.update({ where: { id }, data: { name: s(fd, "name") } });
  revalidateAll();
}

export async function deleteSubmodule(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (id) await prisma.submodule.delete({ where: { id } });
  revalidateAll();
}

/* ----------------------------- Flows ---------------------------- */

export async function createFlow(fd: FormData) {
  await requireAuth();
  const name = s(fd, "name");
  const submoduleId = s(fd, "submoduleId");
  if (!name || !submoduleId) return;
  const count = await prisma.flow.count({ where: { submoduleId } });
  await prisma.flow.create({
    data: {
      name,
      description: s(fd, "description"),
      submoduleId,
      order: count,
    },
  });
  revalidateAll();
}

export async function updateFlow(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  await prisma.flow.update({
    where: { id },
    data: {
      name: s(fd, "name"),
      description: s(fd, "description"),
    },
  });
  revalidateAll();
}

export async function deleteFlow(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (id) await prisma.flow.delete({ where: { id } });
  revalidateAll();
}

/* ------------------------- Linear tickets ----------------------- */
// Multiple per flow, each dated — a change history for the flow.

function parseDate(value: string): Date {
  const d = value ? new Date(value) : new Date();
  return isNaN(d.getTime()) ? new Date() : d;
}

export async function createLinearTicket(fd: FormData) {
  await requireAuth();
  const url = s(fd, "url");
  const flowId = s(fd, "flowId");
  if (!url || !flowId) return;
  await prisma.linearTicket.create({
    data: {
      url,
      label: s(fd, "label"),
      date: parseDate(s(fd, "date")),
      flowId,
    },
  });
  revalidateAll();
}

export async function updateLinearTicket(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  await prisma.linearTicket.update({
    where: { id },
    data: {
      url: s(fd, "url"),
      label: s(fd, "label"),
      date: parseDate(s(fd, "date")),
    },
  });
  revalidateAll();
}

export async function deleteLinearTicket(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  if (id) await prisma.linearTicket.delete({ where: { id } });
  revalidateAll();
}

/* ---------------------------- Designs --------------------------- */

export async function createDesign(fd: FormData) {
  const session = await requireAuth();
  const title = s(fd, "title");
  // The design link can be a Claude share link or a Google Drive link — the
  // delivery dialog sends it as "linkUrl", older forms still send "claudeUrl".
  const linkUrl = s(fd, "linkUrl") || s(fd, "claudeUrl");
  const flowId = s(fd, "flowId");
  if (!title || !flowId) return;
  const variant = s(fd, "variant");
  // Set when delivered from a ticket (board drag-to-done or the ticket detail
  // page) — lets that ticket show only its own deliverables.
  const ticketId = s(fd, "ticketId") || null;
  // Set by the delivery dialog when this delivery should also mark the
  // originating ticket done — folded into the same Linear comment below
  // instead of firing a separate "done" comment right after this one.
  const markDone = s(fd, "markDone") === "1" && !!ticketId;
  const count = await prisma.design.count({ where: { flowId } });
  const design = await prisma.design.create({
    data: { title, claudeUrl: linkUrl, variant, flowId, ticketId, order: count },
  });

  // Optional delivery file (image, PDF, zip, HTML export…). Uploaded to
  // Google Drive and attached to the design just created. If the upload
  // fails, the design row is rolled back so the delivery never half-succeeds.
  const file = fd.get("file");
  let attachmentUrl = "";
  let attachmentDriveUrl = "";
  if (file instanceof File && file.size > 0) {
    try {
      const { path, url, driveUrl } = await uploadAttachment(design.id, file);
      await prisma.designAttachment.create({
        data: {
          designId: design.id,
          name: file.name,
          url,
          path,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          kind: attachmentKind(file.name, file.type),
        },
      });
      attachmentUrl = url;
      attachmentDriveUrl = driveUrl;
    } catch (err) {
      await prisma.design.delete({ where: { id: design.id } }).catch(() => {});
      throw err;
    }
  }

  // Mark the originating ticket done before announcing, so the completion
  // line can be folded into the same delivery comment below rather than
  // posting a second, separate comment.
  if (markDone) {
    await prisma.ticket.update({ where: { id: ticketId! }, data: { status: "done" } });
  }

  // Push the new design to every Linear issue tied to this flow, as the
  // acting designer. Only when there's actually something to announce.
  const sharedUrl = linkUrl || attachmentUrl;
  if (sharedUrl || markDone) {
    const key = await actingLinearKey(session.userId);
    if (key) {
      const tickets = await prisma.ticket.findMany({
        where: { flowId, NOT: { linearUrl: "" } },
        select: { id: true, linearUrl: true },
      });
      const label = variant ? `${title} (${variant})` : title;
      for (const t of tickets) {
        const lines: string[] = [];
        if (sharedUrl) lines.push(`🎨 New design added: **${label}**\n${sharedUrl}`);
        // Fallback so the delivery is still reachable if the app itself is down.
        if (attachmentDriveUrl) lines.push(`📁 Google Drive backup: ${attachmentDriveUrl}`);
        if (markDone && t.id === ticketId) lines.push("✅ Design completed.");
        if (lines.length) await postLinearComment(key, t.linearUrl, lines.join("\n"));
      }
    }
  }
  revalidateAll();
}

export async function updateDesign(fd: FormData) {
  const actor = await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  const design = await prisma.design.findUnique({
    where: { id },
    select: { flowId: true },
  });
  if (!design || !(await canManageFlow(actor, design.flowId))) return;
  await prisma.design.update({
    where: { id },
    data: {
      title: s(fd, "title"),
      claudeUrl: s(fd, "claudeUrl"),
      variant: s(fd, "variant"),
    },
  });
  revalidateAll();
}

export async function deleteDesign(fd: FormData) {
  const actor = await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  const design = await prisma.design.findUnique({
    where: { id },
    select: { flowId: true },
  });
  if (!design || !(await canManageFlow(actor, design.flowId))) return;
  const attachments = await prisma.designAttachment.findMany({
    where: { designId: id },
    select: { path: true },
  });
  await prisma.design.delete({ where: { id } });
  await Promise.all(attachments.map((a) => deleteAttachment(a.path).catch(() => {})));
  revalidateAll();
}

/* ------------------------- Design attachments ------------------------ */
// Files (images, PDFs, zips…) and standalone HTML exports attached to a
// design, stored in Google Drive — this only persists the metadata.

export async function addDesignAttachment(fd: FormData) {
  await requireAuth();
  const designId = s(fd, "designId");
  const file = fd.get("file");
  if (!designId || !(file instanceof File) || file.size === 0) return;

  const { path, url } = await uploadAttachment(designId, file);
  await prisma.designAttachment.create({
    data: {
      designId,
      name: file.name,
      url,
      path,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      kind: attachmentKind(file.name, file.type),
    },
  });
  revalidateAll();
}

export async function deleteDesignAttachment(fd: FormData) {
  const actor = await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  const attachment = await prisma.designAttachment.findUnique({
    where: { id },
    include: { design: { select: { flowId: true } } },
  });
  if (!attachment || !(await canManageFlow(actor, attachment.design.flowId))) return;
  await prisma.designAttachment.delete({ where: { id } });
  await deleteAttachment(attachment.path).catch(() => {});
  revalidateAll();
}

/* ---------------------------- Tickets --------------------------- */

export async function createTicket(fd: FormData) {
  const session = await requireAuth();
  const title = s(fd, "title");
  if (!title) return;
  const status = s(fd, "status") || "todo";
  const linearUrl = s(fd, "linearUrl");
  const flowId = s(fd, "flowId") || null;
  await prisma.ticket.create({
    data: {
      title,
      description: s(fd, "description"),
      status,
      priority: s(fd, "priority") || "medium",
      linearUrl,
      assigneeId: s(fd, "assigneeId") || session.userId,
      solutionId: s(fd, "solutionId") || null,
      flowId,
    },
  });
  // Push to Linear (as the acting designer): announce the status if it wasn't
  // created as a plain "todo". The flow-link comment is intentionally not
  // posted on creation (only later, when the link/flow changes via update).
  if (linearUrl) {
    const key = await actingLinearKey(session.userId);
    if (status !== "todo") await announceStatus(key, linearUrl, status);
  }
  revalidatePath("/manage");
  revalidatePath("/manage/tickets");
}

export async function updateTicket(fd: FormData) {
  const session = await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  const prev = await prisma.ticket.findUnique({ where: { id } });
  if (!prev || !(await canManageFlow(session, prev.flowId, prev.assigneeId))) return;
  const status = s(fd, "status") || "todo";
  const linearUrl = s(fd, "linearUrl");
  const flowId = s(fd, "flowId") || null;
  await prisma.ticket.update({
    where: { id },
    data: {
      title: s(fd, "title"),
      description: s(fd, "description"),
      status,
      priority: s(fd, "priority") || "medium",
      linearUrl,
      assigneeId: s(fd, "assigneeId") || null,
      solutionId: s(fd, "solutionId") || null,
      flowId,
    },
  });
  await syncTicketChanges(await actingLinearKey(session.userId), prev, {
    linearUrl,
    flowId,
    status,
  });
  revalidatePath("/manage");
  revalidatePath("/manage/tickets");
}

export async function setTicketStatus(fd: FormData) {
  const session = await requireAuth();
  const id = s(fd, "id");
  const status = s(fd, "status");
  if (!id || !status) return;
  const prev = await prisma.ticket.findUnique({ where: { id } });
  await prisma.ticket.update({ where: { id }, data: { status } });
  if (prev && prev.status !== status) {
    await announceStatus(await actingLinearKey(session.userId), prev.linearUrl, status);
  }
  revalidatePath("/manage");
  revalidatePath("/manage/tickets");
  revalidatePath(`/manage/tickets/${id}`);
}

export async function deleteTicket(fd: FormData) {
  const actor = await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { flowId: true, assigneeId: true },
  });
  if (!ticket || !(await canManageFlow(actor, ticket.flowId, ticket.assigneeId))) return;
  await prisma.ticket.delete({ where: { id } });
  revalidatePath("/manage");
  revalidatePath("/manage/tickets");
}

// Update the core fields from the ticket detail page. Deliberately does NOT
// touch the hierarchy location (solution/flow) — that's edited from the board
// where the hierarchy picker lives, so we never accidentally clear it here.
export async function updateTicketDetails(fd: FormData) {
  const session = await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  const prev = await prisma.ticket.findUnique({ where: { id } });
  if (!prev || !(await canManageFlow(session, prev.flowId, prev.assigneeId))) return;
  const status = s(fd, "status") || "todo";
  const linearUrl = s(fd, "linearUrl");
  await prisma.ticket.update({
    where: { id },
    data: {
      title: s(fd, "title"),
      description: s(fd, "description"),
      status,
      priority: s(fd, "priority") || "medium",
      linearUrl,
      assigneeId: s(fd, "assigneeId") || null,
    },
  });
  // Hierarchy isn't edited here, so the flow stays whatever it already was.
  await syncTicketChanges(await actingLinearKey(session.userId), prev, {
    linearUrl,
    flowId: prev?.flowId ?? null,
    status,
  });
  revalidatePath("/manage");
  revalidatePath("/manage/tickets");
  revalidatePath(`/manage/tickets/${id}`);
}

export async function deleteTicketAndRedirect(fd: FormData) {
  const actor = await requireAuth();
  const id = s(fd, "id");
  if (!id) return;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { flowId: true, assigneeId: true },
  });
  if (!ticket || !(await canManageFlow(actor, ticket.flowId, ticket.assigneeId))) return;
  await prisma.ticket.delete({ where: { id } });
  revalidatePath("/manage");
  revalidatePath("/manage/tickets");
  redirect("/manage/tickets");
}

/**
 * Build a Claude design-brief prompt for a ticket: pulls the ticket's hierarchy
 * (solution → flow), enriches it with the live Linear issue when one is linked,
 * and folds in the solution's brand color + a set of design rules. Returned to
 * the client to copy into Claude.
 */
export async function generateDesignPrompt(
  ticketId: string
): Promise<{ prompt: string } | { error: string }> {
  const session = await requireAuth();
  if (!ticketId) return { error: "Missing ticket." };

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      solution: true,
      flow: {
        include: { submodule: { include: { module: true } } },
      },
    },
  });
  if (!ticket) return { error: "Ticket not found." };

  // Enrich with the live Linear issue when one is linked (best-effort).
  const linear = ticket.linearUrl
    ? await getLinearIssue(await actingLinearKey(session.userId), ticket.linearUrl)
    : null;

  const prompt = buildDesignPrompt({
    ticket: {
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      linearUrl: ticket.linearUrl,
    },
    solution: ticket.solution
      ? {
          name: ticket.solution.name,
          tagline: ticket.solution.tagline,
          description: ticket.solution.description,
          color: ticket.solution.color,
          language: ticket.solution.language,
        }
      : null,
    path: {
      module: ticket.flow?.submodule?.module?.name ?? null,
      submodule: ticket.flow?.submodule?.name ?? null,
      flow: ticket.flow?.name ?? null,
    },
    linear,
  });

  return { prompt };
}

/* ---------------------------- Comments -------------------------- */

export async function addComment(fd: FormData) {
  const session = await requireAuth();
  const ticketId = s(fd, "ticketId");
  const body = s(fd, "body");
  if (!ticketId || !body) return;
  await prisma.comment.create({
    data: { ticketId, body, authorId: session.userId },
  });
  revalidatePath(`/manage/tickets/${ticketId}`);
}

export async function deleteComment(fd: FormData) {
  await requireAuth();
  const id = s(fd, "id");
  const ticketId = s(fd, "ticketId");
  if (id) await prisma.comment.delete({ where: { id } });
  if (ticketId) revalidatePath(`/manage/tickets/${ticketId}`);
}

/* ------------- Quick-create (used by the ticket picker) -------------- */
// These accept plain string args, create the record, and RETURN the new
// row so the client can append it to the dropdowns and select it.

const PALETTE = [
  "#1f47eb", "#0ea5a3", "#f97316", "#a855f7",
  "#e11d48", "#2563eb", "#059669", "#0f172a",
];

async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
) {
  const root = base || "item";
  let slug = root;
  let n = 2;
  while (await exists(slug)) slug = `${root}-${n++}`;
  return slug;
}

export async function quickCreateSolution(name: string) {
  await requireAuth();
  const clean = name.trim();
  if (!clean) throw new Error("Name required");
  const count = await prisma.solution.count();
  const slug = await uniqueSlug(
    slugify(clean),
    async (sl) => !!(await prisma.solution.findUnique({ where: { slug: sl } }))
  );
  const row = await prisma.solution.create({
    data: {
      name: clean,
      slug,
      color: PALETTE[count % PALETTE.length],
      icon: "✦",
      language: "en",
      order: count,
    },
  });
  revalidateAll();
  return { id: row.id, name: row.name };
}

export async function quickCreateModule(solutionId: string, name: string) {
  await requireAuth();
  const clean = name.trim();
  if (!clean || !solutionId) throw new Error("Missing data");
  const count = await prisma.module.count({ where: { solutionId } });
  const slug = await uniqueSlug(
    slugify(clean),
    async (sl) =>
      !!(await prisma.module.findUnique({
        where: { solutionId_slug: { solutionId, slug: sl } },
      }))
  );
  const row = await prisma.module.create({
    data: { name: clean, slug, solutionId, order: count },
  });
  revalidateAll();
  return { id: row.id, name: row.name };
}

export async function quickCreateSubmodule(moduleId: string, name: string) {
  await requireAuth();
  const clean = name.trim();
  if (!clean || !moduleId) throw new Error("Missing data");
  const count = await prisma.submodule.count({ where: { moduleId } });
  const slug = await uniqueSlug(
    slugify(clean),
    async (sl) =>
      !!(await prisma.submodule.findUnique({
        where: { moduleId_slug: { moduleId, slug: sl } },
      }))
  );
  const row = await prisma.submodule.create({
    data: { name: clean, slug, moduleId, order: count },
  });
  revalidateAll();
  return { id: row.id, name: row.name };
}

export async function quickCreateFlow(submoduleId: string, name: string) {
  await requireAuth();
  const clean = name.trim();
  if (!clean || !submoduleId) throw new Error("Missing data");
  const count = await prisma.flow.count({ where: { submoduleId } });
  const row = await prisma.flow.create({
    data: { name: clean, submoduleId, order: count },
  });
  revalidateAll();
  return { id: row.id, name: row.name };
}
