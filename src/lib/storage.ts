// Google Drive storage for design attachments (files + standalone HTML
// exports). Files are uploaded by a service account into a shared Drive
// folder and stay private — the app streams them back through
// /api/files/[id], which is behind the login wall. Server-only: uses the
// service-account private key, so it must never be imported into client
// components.

import { SignJWT, importPKCS8 } from "jose";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — see .env.example.`);
  }
  return value;
}

/* ------------------------ Service-account token ----------------------- */
// Standard two-legged OAuth: sign a JWT with the service account's private
// key, exchange it for a short-lived access token. Cached until ~1 min
// before expiry so uploads/downloads don't mint a token per request.

let cachedToken: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const email = env("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  // .env files store the PEM on one line with literal \n escapes.
  const pem = env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "RS256");

  const assertion = await new SignJWT({ scope: DRIVE_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(email)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

/* ----------------------------- Attachments ---------------------------- */

/** Kind is derived from the filename so standalone HTML exports get a preview action. */
export function attachmentKind(filename: string, mimeType: string): "file" | "html" {
  return filename.toLowerCase().endsWith(".html") || mimeType === "text/html"
    ? "html"
    : "file";
}

/** App-origin download URL for a Drive file — absolute when APP_BASE_URL is set, so it also works in Linear comments. */
function downloadUrl(fileId: string): string {
  const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/api/files/${fileId}`;
}

/**
 * Upload a delivery file to the Drive folder. Uses a resumable upload
 * because deliveries regularly exceed the 5 MB cap of Drive's simple and
 * multipart uploads. Returns the Drive file id as `path` (used for delete
 * and streaming) and the app-served URL stored on the attachment row.
 */
export async function uploadAttachment(designId: string, file: File) {
  const token = await accessToken();
  const folderId = env("GOOGLE_DRIVE_FOLDER_ID");
  const contentType = file.type || "application/octet-stream";

  // Step 1: open a resumable session with the file metadata.
  const init = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": contentType,
        "X-Upload-Content-Length": String(file.size),
      },
      body: JSON.stringify({
        name: file.name,
        parents: [folderId],
        // Traceability back to the app when browsing the folder in Drive.
        appProperties: { designId },
      }),
    }
  );
  if (!init.ok) {
    throw new Error(`Drive upload init failed (${init.status}): ${await init.text()}`);
  }
  const sessionUrl = init.headers.get("Location");
  if (!sessionUrl) throw new Error("Drive upload init returned no session URL.");

  // Step 2: send the bytes in a single request.
  const upload = await fetch(sessionUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(await file.arrayBuffer()),
  });
  if (!upload.ok) {
    throw new Error(`Drive upload failed (${upload.status}): ${await upload.text()}`);
  }
  const created = (await upload.json()) as { id: string };

  return { path: created.id, url: downloadUrl(created.id) };
}

/** Stream a stored file back from Drive. Returns the upstream response (body + content headers). */
export async function fetchAttachment(fileId: string): Promise<Response> {
  const token = await accessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    throw new Error(`Drive download failed (${res.status}): ${await res.text()}`);
  }
  return res;
}

export async function deleteAttachment(path: string) {
  const token = await accessToken();
  await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(path)}?supportsAllDrives=true`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
}
