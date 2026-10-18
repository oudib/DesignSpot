// Bearer-key authentication for the REST API under /api/v1.
//
// A request carries `Authorization: Bearer sds_…`. The key is hashed and looked
// up; a live key resolves to its owning user, and the request then acts as that
// user — same workspace permissions, same Linear connection — exactly as if
// they were clicking in /manage. Keys of users whose workspace access was
// revoked stop working immediately, since the role is read from the DB.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasWorkspaceAccess } from "@/lib/auth";
import { hashApiKey, looksLikeApiKey } from "@/lib/apiKeys";
import { ServiceError } from "@/lib/errors";

export type ApiActor = {
  userId: string;
  isAdmin: boolean;
  user: { id: string; name: string; email: string; role: string };
  apiKey: { id: string; name: string };
};

export class ApiAuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  // Also accepted, for clients that can't set Authorization.
  return req.headers.get("x-api-key")?.trim() || null;
}

/** Resolve the request's API key to an actor, or throw ApiAuthError. */
export async function authenticateApiRequest(req: NextRequest): Promise<ApiActor> {
  const token = bearerToken(req);
  if (!token) {
    throw new ApiAuthError(401, "Missing API key. Send `Authorization: Bearer sds_…`.");
  }
  if (!looksLikeApiKey(token)) {
    throw new ApiAuthError(401, "Malformed API key.");
  }
  const row = await prisma.apiKey.findUnique({
    where: { hash: hashApiKey(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!row || row.revokedAt) {
    throw new ApiAuthError(401, "Invalid or revoked API key.");
  }
  if (!hasWorkspaceAccess(row.user.role)) {
    throw new ApiAuthError(403, "The key's owner no longer has workspace access.");
  }
  // Best-effort usage stamp; never let it fail the request.
  prisma.apiKey
    .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return {
    userId: row.user.id,
    isAdmin: row.user.role === "admin",
    user: row.user,
    apiKey: { id: row.id, name: row.name },
  };
}

export function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

type Handler<Ctx> = (
  req: NextRequest,
  actor: ApiActor,
  ctx: Ctx
) => Promise<Response> | Response;

/**
 * Wrap a route handler: authenticate, run, and turn thrown ServiceError /
 * ApiAuthError / JSON-parse failures into JSON error responses. Anything else
 * is logged and reported as a 500 without leaking internals.
 */
export function withApiAuth<Ctx = unknown>(handler: Handler<Ctx>) {
  return async (req: NextRequest, ctx: Ctx): Promise<Response> => {
    try {
      const actor = await authenticateApiRequest(req);
      return await handler(req, actor, ctx);
    } catch (err) {
      if (err instanceof ApiAuthError) return jsonError(err.status, err.message);
      if (err instanceof ServiceError) return jsonError(err.status, err.message);
      if (err instanceof SyntaxError) return jsonError(400, "Body is not valid JSON.");
      console.error("[api/v1]", err);
      const message = err instanceof Error ? err.message : "Internal error.";
      return jsonError(500, message);
    }
  };
}

/** Parse a JSON body, or a multipart/form-data body into a plain object (files kept as File). */
export async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data") || type.includes("application/x-www-form-urlencoded")) {
    const fd = await req.formData();
    const out: Record<string, unknown> = {};
    fd.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  const text = await req.text();
  if (!text.trim()) return {};
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ServiceError(400, "Body must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

/** Coerce a body field to a trimmed string, or undefined when absent. */
export function str(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  if (v instanceof File) return undefined;
  return String(v).trim();
}

export function bool(body: Record<string, unknown>, key: string): boolean | undefined {
  const v = body[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

export function file(body: Record<string, unknown>, key = "file"): File | undefined {
  const v = body[key];
  return v instanceof File && v.size > 0 ? v : undefined;
}

/**
 * Ticket fields from a request body, in the shape src/lib/tickets.ts takes:
 * absent keys stay undefined (untouched on PATCH), an explicit `null` clears an
 * optional relation (assigneeId / solutionId / flowId).
 */
export function readTicketPatch(body: Record<string, unknown>) {
  const nullable = (k: string) => {
    if (!(k in body)) return undefined;
    return body[k] === null ? null : (str(body, k) ?? null);
  };
  return {
    title: str(body, "title"),
    description: str(body, "description"),
    status: str(body, "status"),
    priority: str(body, "priority"),
    linearUrl: str(body, "linearUrl"),
    assigneeId: nullable("assigneeId"),
    solutionId: nullable("solutionId"),
    flowId: nullable("flowId"),
  };
}
