// JSON shapes returned by /api/v1. Kept flat and self-describing so an agent
// can act on a response without knowing the Prisma schema: every delivery
// file carries ready-made preview / download / Drive URLs, every ticket its
// location in the hierarchy as names as well as ids.

import { absoluteUrl } from "@/lib/linear";
import { attachmentPreviewUrl, attachmentDriveUrl } from "@/lib/attachmentUrl";

type UserLite = { id: string; name: string; email: string } | null;

export function serializeUser(u: { id: string; name: string; email: string; role: string }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

export function serializeComment(c: {
  id: string;
  body: string;
  createdAt: Date;
  author: UserLite;
}) {
  return { id: c.id, body: c.body, createdAt: c.createdAt, author: c.author };
}

export function serializeAttachment(a: {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  kind: string;
  version: number;
  rootId: string | null;
  createdAt: Date;
}) {
  return {
    id: a.id,
    name: a.name,
    mimeType: a.mimeType,
    size: a.size,
    kind: a.kind, // "file" | "html"
    version: a.version,
    rootId: a.rootId ?? a.id,
    // Rebuilt from the Drive id so it always points at the current APP_BASE_URL.
    downloadUrl: absoluteUrl(`/api/files/${a.url.split("/api/files/").pop()}`),
    previewUrl: absoluteUrl(attachmentPreviewUrl(a.url)),
    driveUrl: attachmentDriveUrl(a.url),
    createdAt: a.createdAt,
  };
}

export function serializeDelivery(d: {
  id: string;
  title: string;
  claudeUrl: string;
  variant: string;
  flowId: string;
  ticketId: string | null;
  createdAt: Date;
  updatedAt: Date;
  attachments: Parameters<typeof serializeAttachment>[0][];
  flow?: { id: string; name: string } | null;
  ticket?: { id: string; title: string; status: string } | null;
}) {
  return {
    id: d.id,
    title: d.title,
    linkUrl: d.claudeUrl,
    variant: d.variant,
    flowId: d.flowId,
    flow: d.flow ?? null,
    ticketId: d.ticketId,
    ticket: d.ticket ?? null,
    files: d.attachments.map(serializeAttachment),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

type TicketRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  linearUrl: string;
  createdAt: Date;
  updatedAt: Date;
  assigneeId: string | null;
  solutionId: string | null;
  flowId: string | null;
  assignee: UserLite;
  solution: { id: string; name: string; slug: string } | null;
  flow: {
    id: string;
    name: string;
    submodule: { id: string; name: string; module: { id: string; name: string } };
  } | null;
};

export function serializeTicket(t: TicketRow) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    linearUrl: t.linearUrl,
    assignee: t.assignee,
    solution: t.solution,
    flow: t.flow
      ? {
          id: t.flow.id,
          name: t.flow.name,
          submodule: { id: t.flow.submodule.id, name: t.flow.submodule.name },
          module: t.flow.submodule.module,
          url: absoluteUrl(`/flows/${t.flow.id}`),
        }
      : null,
    url: absoluteUrl(`/manage/tickets/${t.id}`),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}
