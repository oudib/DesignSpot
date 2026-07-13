import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { fetchAttachment } from "@/lib/storage";
import { extractAssets } from "@/lib/renderAssets";

// Rendering can take a while for heavier exports; keep this well under a
// typical serverless function limit so a slow render fails cleanly.
export const maxDuration = 45;

// Zips every inline SVG icon and image referenced by a standalone HTML
// export, for the preview page's "Download Assets" button.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const attachment = await prisma.designAttachment.findFirst({
    where: { path: id },
  });
  if (!attachment || attachment.kind !== "html") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const upstream = await fetchAttachment(id);
  const html = await upstream.text();
  const { icons, images } = await extractAssets(html);

  if (icons.length === 0 && images.length === 0) {
    return NextResponse.json(
      { error: "No icons or images found in this file." },
      { status: 404 }
    );
  }

  const zip = new JSZip();
  for (const icon of icons) zip.file(`icons/${icon.name}`, icon.data);
  for (const image of images) zip.file(`images/${image.name}`, image.data);
  const buffer = await zip.generateAsync({ type: "arraybuffer" });

  const zipName = `${attachment.name.replace(/\.html?$/i, "")}-assets.zip`;
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(zipName)}"`,
    },
  });
}
