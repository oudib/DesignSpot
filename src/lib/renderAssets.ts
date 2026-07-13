import { chromium, type Browser } from "playwright-core";

// Vercel/Lambda's serverless runtime has no browser preinstalled and can't
// fit Playwright's own ~170 MB Chromium download in the function bundle, so
// production uses @sparticuz/chromium's Lambda-compatible binary instead.
// Locally, playwright-core finds the Chromium already downloaded by the
// `playwright` devDependency (`npx playwright install chromium`).
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

async function launch(): Promise<Browser> {
  if (isServerless) {
    const sparticuzChromium = (await import("@sparticuz/chromium")).default;
    return chromium.launch({
      args: sparticuzChromium.args,
      executablePath: await sparticuzChromium.executablePath(),
      headless: true,
    });
  }
  return chromium.launch({ headless: true });
}

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
  "image/avif": "avif",
};

function extFromMime(mime: string): string {
  return MIME_EXT[mime.toLowerCase()] ?? "bin";
}

// Reused across requests in a long-running server; relaunched if it ever
// disconnects (e.g. the Chromium process crashed).
let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null);
    if (browser?.isConnected()) return browser;
    browserPromise = null;
  }
  browserPromise = launch();
  return browserPromise;
}

/**
 * Standalone HTML exports commonly self-extract: the file on disk is just a
 * loader plus base64-encoded asset blobs, and the real page — including any
 * icons a JS/template engine draws at render time — only exists once a
 * browser actually runs it. So instead of scanning the raw markup, this
 * loads the export in headless Chromium, waits for it to finish
 * unpacking/rendering, and pulls the real <svg> and <img> content straight
 * out of the live DOM.
 */
export async function extractAssets(
  html: string
): Promise<{ icons: ExtractedFile[]; images: ExtractedFile[] }> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15000 });

    // Self-extracting "bundler" exports show a loader while they unpack —
    // wait for it to be replaced by the real page before reading the DOM.
    const loader = await page.$("#__bundler_loading");
    if (loader) {
      await page
        .waitForSelector("#__bundler_loading", { state: "detached", timeout: 15000 })
        .catch(() => {});
    }
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    // Charts/animations often settle a beat after the DOM stabilizes.
    await page.waitForTimeout(300);

    const svgHtmls = await page.$$eval("svg", (els) =>
      els.filter((el) => !el.parentElement?.closest("svg")).map((el) => el.outerHTML)
    );

    const imgSrcs = await page.$$eval("img", (els) =>
      Array.from(
        new Set(
          els
            .map((el) => el.currentSrc || el.src)
            .filter((src): src is string => Boolean(src))
        )
      )
    );

    const icons: ExtractedFile[] = svgHtmls.map((svg, i) => ({
      name: `icon-${i + 1}.svg`,
      data: Buffer.from(svg, "utf-8"),
    }));

    const images: ExtractedFile[] = [];
    for (const src of imgSrcs) {
      const result = await page
        .evaluate(async (url) => {
          const res = await fetch(url);
          const blob = await res.blob();
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let bin = "";
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          return { mime: blob.type, base64: btoa(bin) };
        }, src)
        .catch(() => null);
      if (!result) continue;
      images.push({
        name: `image-${images.length + 1}.${extFromMime(result.mime)}`,
        data: Buffer.from(result.base64, "base64"),
      });
    }

    return { icons, images };
  } finally {
    await page.close();
  }
}
