// Pulls every inline <svg> icon and every raster/vector image (data URI or
// remote URL) referenced from a standalone HTML export, for the "Download
// Assets" zip. Regex-based rather than a full HTML/CSS parser — these
// exports are single, mostly-flat files, so this covers the common cases
// (img src, css url(), inline svg) without pulling in a DOM dependency.

export type ExtractedFile = { name: string; data: Buffer };

const MIME_EXT: Record<string, string> = {
  "image/svg+xml": "svg",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/x-icon": "ico",
  "image/bmp": "bmp",
};

function extFromMime(mime: string): string {
  return MIME_EXT[mime.toLowerCase()] ?? "bin";
}

function extFromUrl(url: string): string {
  const match = /\.([a-zA-Z0-9]+)(?:[?#]|$)/.exec(url.split("/").pop() ?? "");
  return match ? match[1].toLowerCase() : "bin";
}

async function fetchAsBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function extractAssets(
  html: string
): Promise<{ icons: ExtractedFile[]; images: ExtractedFile[] }> {
  const icons: ExtractedFile[] = [];
  const images: ExtractedFile[] = [];

  let iconIndex = 0;
  for (const match of html.matchAll(/<svg[\s\S]*?<\/svg>/gi)) {
    iconIndex += 1;
    icons.push({ name: `icon-${iconIndex}.svg`, data: Buffer.from(match[0], "utf-8") });
  }

  const urls = new Set<string>();
  for (const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    urls.add(match[1]);
  }
  for (const match of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    urls.add(match[1]);
  }

  let imageIndex = 0;
  for (const url of urls) {
    if (url.startsWith("data:image/")) {
      const dataMatch = /^data:([^;]+);base64,(.+)$/.exec(url);
      if (!dataMatch) continue;
      const [, mime, base64] = dataMatch;
      imageIndex += 1;
      images.push({
        name: `image-${imageIndex}.${extFromMime(mime)}`,
        data: Buffer.from(base64, "base64"),
      });
      continue;
    }

    if (/^https?:\/\//i.test(url) && /\.(png|jpe?g|gif|webp|svg|ico|bmp)(?:[?#]|$)/i.test(url)) {
      const buf = await fetchAsBuffer(url);
      if (!buf) continue;
      imageIndex += 1;
      images.push({ name: `image-${imageIndex}.${extFromUrl(url)}`, data: buf });
    }
  }

  return { icons, images };
}
