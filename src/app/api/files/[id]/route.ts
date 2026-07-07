import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fetchAttachment } from "@/lib/storage";

// Streams a design attachment from Google Drive. Files in Drive stay
// private (only the service account can read them); this route is the only
// way to reach them, and the middleware already requires a login for it —
// the session check here is defense in depth.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  // Only files the app knows about are served — the row also carries the
  // original filename and MIME type, saving a Drive metadata round-trip.
  const attachment = await prisma.designAttachment.findFirst({
    where: { path: id },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const upstream = await fetchAttachment(id);

  const headers = new Headers({
    "Content-Type": attachment.mimeType || "application/octet-stream",
    "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.name)}"`,
    // Attachments never change once uploaded (a new upload gets a new id).
    "Cache-Control": "private, max-age=3600",
  });
  if (attachment.size > 0) headers.set("Content-Length", String(attachment.size));
  // Standalone HTML exports render in the browser, but sandboxed so an
  // uploaded page can never touch the app's origin (cookies, storage).
  if (attachment.kind === "html") {
    headers.set("Content-Security-Policy", "sandbox allow-scripts allow-popups");
  }

  return new Response(upstream.body, { headers });
}
