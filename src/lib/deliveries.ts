// Delivery (= Design row) operations shared by the /manage server actions and
// the /api/v1 routes. A delivery is a design attached to a flow — a Claude /
// Drive link, an uploaded file (image, PDF, zip, standalone HTML export), or
// both — optionally tied to the ticket it was delivered for. Uploads go to
// Google Drive via src/lib/storage.ts; Linear comments are posted as the
// acting user on every issue linked to the flow.

import { prisma } from "@/lib/db";
import { canManageFlow } from "@/lib/access";
import type { Actor } from "@/lib/utils";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { postLinearComment, deleteLinearCommentsWithPrefix, absoluteUrl } from "@/lib/linear";
import { actingLinearKey, linkFlowToLinear } from "@/lib/linearSync";
import { uploadAttachment, deleteAttachment, attachmentKind } from "@/lib/storage";
import { attachmentPreviewUrl } from "@/lib/attachmentUrl";

export type DeliveryActor = NonNullable<Actor>;

export type DeliveryInput = {
  title: string;
  /** Claude share link or Google Drive link. */
  linkUrl?: string;
  variant?: string;
  /** The flow to deliver into. Defaults to the ticket's flow when `ticketId` is set. */
  flowId?: string | null;
  /** The ticket this delivery fulfils. */
  ticketId?: string | null;
  /** Also mark that ticket done, folded into the same Linear comment. */
  markDone?: boolean;
  /** Optional delivery file. */
  file?: File | null;
};

export const deliveryInclude = {
  attachments: { orderBy: { createdAt: "asc" } },
  flow: { select: { id: true, name: true } },
  ticket: { select: { id: true, title: true, status: true } },
} as const;

async function createAttachmentRow(
  designId: string,
  file: File,
  extra: { rootId?: string; version?: number } = {}
) {
  const { path, url, driveUrl } = await uploadAttachment(designId, file);
  const row = await prisma.designAttachment.create({
    data: {
      designId,
      name: file.name,
      url,
      path,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      kind: attachmentKind(file.name, file.type),
      ...extra,
    },
  });
  return { row, driveUrl };
}

export async function createDelivery(actor: DeliveryActor, input: DeliveryInput) {
  const title = (input.title ?? "").trim();
  if (!title) throw badRequest("title is required.");
  const linkUrl = (input.linkUrl ?? "").trim();
  const variant = (input.variant ?? "").trim();
  const ticketId = input.ticketId || null;

  let flowId = input.flowId || null;
  let ticket: { flowId: string | null; linearUrl: string } | null = null;
  if (ticketId) {
    ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { flowId: true, linearUrl: true },
    });
    if (!ticket) throw notFound("Ticket not found.");
    if (!flowId) flowId = ticket.flowId;
    if (!flowId) {
      throw badRequest(
        "That ticket has no flow yet. Pass flowId here (the ticket will be attached to it), " +
          "or set it first with PATCH /api/v1/tickets/{id}. Create one with POST /api/v1/flows if needed."
      );
    }
  }
  if (!flowId) throw badRequest("flowId (or a ticketId whose ticket has a flow) is required.");
  const flow = await prisma.flow.findUnique({
    where: { id: flowId },
    select: { id: true, submodule: { select: { module: { select: { solutionId: true } } } } },
  });
  if (!flow) throw badRequest(`No flow with id "${flowId}".`);

  // Delivering a flow-less ticket into a flow is how that ticket gets its
  // place in the hierarchy — same as picking a flow on the ticket page.
  if (ticket && ticketId && !ticket.flowId) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { flowId, solutionId: flow.submodule.module.solutionId },
    });
    await linkFlowToLinear(await actingLinearKey(actor.userId), ticket.linearUrl, flowId);
  }

  const markDone = !!input.markDone && !!ticketId;
  const count = await prisma.design.count({ where: { flowId } });
  const design = await prisma.design.create({
    data: { title, claudeUrl: linkUrl, variant, flowId, ticketId, order: count },
  });

  // Optional delivery file. If the upload fails, the design row is rolled
  // back so the delivery never half-succeeds.
  let attachmentUrl = "";
  let attachmentDriveUrl = "";
  if (input.file && input.file.size > 0) {
    try {
      const { row, driveUrl } = await createAttachmentRow(design.id, input.file);
      attachmentUrl = row.url;
      attachmentDriveUrl = driveUrl;
    } catch (err) {
      await prisma.design.delete({ where: { id: design.id } }).catch(() => {});
      throw err;
    }
  }

  // Mark the originating ticket done before announcing, so the completion
  // line can be folded into the same delivery comment below.
  if (markDone) {
    await prisma.ticket.update({ where: { id: ticketId! }, data: { status: "done" } });
  }

  // Push the new design to every Linear issue tied to this flow, as the
  // acting user. Only when there's actually something to announce.
  const sharedUrl = linkUrl || attachmentUrl;
  if (sharedUrl || markDone) {
    const key = await actingLinearKey(actor.userId);
    if (key) {
      const tickets = await prisma.ticket.findMany({
        where: { flowId, NOT: { linearUrl: "" } },
        select: { id: true, linearUrl: true },
      });
      const previewUrl = attachmentUrl ? absoluteUrl(attachmentPreviewUrl(attachmentUrl)) : "";
      const secondary = [
        linkUrl && `[Claude design link](${linkUrl})`,
        attachmentDriveUrl && `[GD Backup link](${attachmentDriveUrl})`,
      ].filter(Boolean);
      for (const t of tickets) {
        const lines: string[] = [];
        if (sharedUrl) lines.push(`Design Added: 🔗 [Link here](${previewUrl || sharedUrl})`);
        if (secondary.length) lines.push(secondary.join(" - "));
        if (markDone && t.id === ticketId) lines.push("✅ Design completed.");
        if (lines.length) await postLinearComment(key, t.linearUrl, lines.join("\n"));
      }
    }
  }

  return prisma.design.findUniqueOrThrow({ where: { id: design.id }, include: deliveryInclude });
}

export async function updateDelivery(
  actor: DeliveryActor,
  id: string,
  patch: { title?: string; linkUrl?: string; variant?: string }
) {
  const design = await prisma.design.findUnique({ where: { id }, select: { flowId: true } });
  if (!design) throw notFound("Delivery not found.");
  if (!(await canManageFlow(actor, design.flowId))) throw forbidden();
  const data: Record<string, string> = {};
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) throw badRequest("title can't be empty.");
    data.title = title;
  }
  if (patch.linkUrl !== undefined) data.claudeUrl = patch.linkUrl.trim();
  if (patch.variant !== undefined) data.variant = patch.variant.trim();
  return prisma.design.update({ where: { id }, data, include: deliveryInclude });
}

export async function deleteDelivery(actor: DeliveryActor, id: string) {
  const design = await prisma.design.findUnique({ where: { id }, select: { flowId: true } });
  if (!design) throw notFound("Delivery not found.");
  if (!(await canManageFlow(actor, design.flowId))) throw forbidden();
  const attachments = await prisma.designAttachment.findMany({
    where: { designId: id },
    select: { path: true },
  });
  await prisma.design.delete({ where: { id } });
  await Promise.all(attachments.map((a) => deleteAttachment(a.path).catch(() => {})));
}

/** Attach a new, unrelated file to an existing delivery. */
export async function addDeliveryFile(actor: DeliveryActor, designId: string, file: File) {
  void actor; // same gate as the UI: any workspace user may attach a file
  if (!file || file.size === 0) throw badRequest("file is required.");
  const design = await prisma.design.findUnique({ where: { id: designId }, select: { id: true } });
  if (!design) throw notFound("Delivery not found.");
  const { row } = await createAttachmentRow(designId, file);
  return row;
}

/**
 * Upload a redesign as the next version of an existing attachment instead of a
 * new, unrelated file. The chain's first version keeps its Drive id, so the
 * `/preview/{driveId}` link already shared in Linear comments now renders this
 * new version — reviewers don't need a new link.
 */
export async function addDeliveryRevision(
  actor: DeliveryActor,
  attachmentId: string,
  file: File
) {
  if (!file || file.size === 0) throw badRequest("file is required.");
  const current = await prisma.designAttachment.findUnique({
    where: { id: attachmentId },
    include: { design: { select: { id: true, title: true, flowId: true } } },
  });
  if (!current) throw notFound("Attachment not found.");
  if (!(await canManageFlow(actor, current.design.flowId))) throw forbidden();

  // Versions are numbered per chain, so pick up from whatever is highest —
  // the call may target an older version of the chain.
  const rootId = current.rootId ?? current.id;
  const chain = await prisma.designAttachment.findMany({
    where: { OR: [{ id: rootId }, { rootId }] },
    orderBy: { version: "asc" },
  });
  const nextVersion = Math.max(...chain.map((a) => a.version), 1) + 1;

  const { row } = await createAttachmentRow(current.design.id, file, {
    rootId,
    version: nextVersion,
  });

  // The preview link shared on the first upload is stable across versions, so a
  // revision points back at that same root link — no Drive backup, no v-number.
  const key = await actingLinearKey(actor.userId);
  if (key) {
    const tickets = await prisma.ticket.findMany({
      where: { flowId: current.design.flowId, NOT: { linearUrl: "" } },
      select: { linearUrl: true },
    });
    const rootUrl = chain.find((a) => a.id === rootId)?.url ?? row.url;
    const prefix = "Design Updated:";
    const body = `${prefix} 🔗 [Link here](${absoluteUrl(attachmentPreviewUrl(rootUrl))})`;
    for (const t of tickets) {
      // Only the latest notice matters, so clear the earlier ones instead of
      // stacking a near-identical comment on every revision.
      await deleteLinearCommentsWithPrefix(key, t.linearUrl, prefix);
      await postLinearComment(key, t.linearUrl, body);
    }
  }
  return row;
}

export async function deleteDeliveryFile(actor: DeliveryActor, attachmentId: string) {
  const attachment = await prisma.designAttachment.findUnique({
    where: { id: attachmentId },
    include: { design: { select: { flowId: true } } },
  });
  if (!attachment) throw notFound("Attachment not found.");
  if (!(await canManageFlow(actor, attachment.design.flowId))) throw forbidden();

  // Removing a deliverable removes every version of it — the UI only ever shows
  // the newest one, so leaving older revisions (and their Drive files) behind
  // would just orphan them.
  const rootId = attachment.rootId ?? attachment.id;
  const chain = await prisma.designAttachment.findMany({
    where: { OR: [{ id: rootId }, { rootId }] },
    select: { id: true, path: true },
  });
  await prisma.designAttachment.deleteMany({ where: { id: { in: chain.map((a) => a.id) } } });
  await Promise.all(chain.map((a) => deleteAttachment(a.path).catch(() => {})));
}
