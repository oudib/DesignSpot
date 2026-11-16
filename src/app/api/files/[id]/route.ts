import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fetchAttachment } from "@/lib/storage";
import { withOutsideLinksInNewTab } from "@/lib/previewLinks";

// Streams a design attachment from Google Drive. Files in Drive stay
// private (only the service account can read them); this route is the only
// way to reach them, and the middleware already requires a login for it —
// the session check here is defense in depth.
export async function GET(
  req: NextRequest,
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

  // The preview page's "Download" button links here with ?download=1 to
  // force a save-as instead of the default inline render.
  const download = req.nextUrl.searchParams.has("download");
  const disposition = download ? "attachment" : "inline";
  const headers = new Headers({
    "Content-Type": attachment.mimeType || "application/octet-stream",
    "Content-Disposition": `${disposition}; filename="${encodeURIComponent(attachment.name)}"`,
    // Attachments never change once uploaded (a new upload gets a new id).
    "Cache-Control": "private, max-age=3600",
  });
  // Standalone HTML exports render in the browser, but sandboxed so an
  // uploaded page can never touch the app's origin (cookies, storage).
  if (attachment.kind === "html") {
    headers.set("Content-Security-Policy", "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox");
  }

  // Rendered HTML gets a small script appended so links to other sites open
  // in a new tab (see previewLinks). Its length differs from the stored size,
  // so that response goes out without a Content-Length.
  if (attachment.kind === "html" && !download && upstream.body) {
    return new Response(withOutsideLinksInNewTab(upstream.body), { headers });
  }

  if (attachment.size > 0) headers.set("Content-Length", String(attachment.size));
  return new Response(upstream.body, { headers });
}
