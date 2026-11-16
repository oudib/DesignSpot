import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fetchAttachment } from "@/lib/storage";
import { createHash } from "crypto";
import { PREVIEW_SCRIPT_SOURCE, withOutsideLinksInNewTab } from "@/lib/previewLinks";

// Standalone HTML exports render in the browser, but sandboxed so an
// uploaded page can never touch the app's origin (cookies, storage).
// Popups escape the sandbox: Chrome refuses to load sites like Gmail, which
// send a Cross-Origin-Opener-Policy, in a tab that inherited it.
const HTML_CSP = "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox";

// Changes whenever the header or the appended script does, so browsers
// holding an older rendering of a design fetch it again.
const HTML_PREVIEW_VERSION = createHash("sha256")
  .update(HTML_CSP)
  .update(PREVIEW_SCRIPT_SOURCE)
  .digest("hex")
  .slice(0, 12);

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

  // The preview page's "Download" button links here with ?download=1 to
  // force a save-as instead of the default inline render.
  const download = req.nextUrl.searchParams.has("download");
  const disposition = download ? "attachment" : "inline";
  const htmlPreview = attachment.kind === "html" && !download;

  // Attachments never change once uploaded (a new upload gets a new id), so
  // files are cached for an hour. A rendered HTML preview also carries the
  // sandbox header and script above, which can change with a deploy: it is
  // revalidated on every view instead, and answered with a 304, without
  // touching Drive, while the browser's copy is still current.
  const etag = htmlPreview ? `"${id}-${HTML_PREVIEW_VERSION}"` : null;
  const cacheControl = htmlPreview ? "private, no-cache" : "private, max-age=3600";
  if (etag && req.headers.get("if-none-match")?.includes(etag)) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": cacheControl } });
  }

  const upstream = await fetchAttachment(id);

  const headers = new Headers({
    "Content-Type": attachment.mimeType || "application/octet-stream",
    "Content-Disposition": `${disposition}; filename="${encodeURIComponent(attachment.name)}"`,
    "Cache-Control": cacheControl,
  });
  if (etag) headers.set("ETag", etag);
  if (attachment.kind === "html") headers.set("Content-Security-Policy", HTML_CSP);

  // Rendered HTML gets a small script appended so links to other sites open
  // in a new tab (see previewLinks). Its length differs from the stored size,
  // so that response goes out without a Content-Length.
  if (htmlPreview && upstream.body) {
    return new Response(withOutsideLinksInNewTab(upstream.body), { headers });
  }

  if (attachment.size > 0) headers.set("Content-Length", String(attachment.size));
  return new Response(upstream.body, { headers });
}
