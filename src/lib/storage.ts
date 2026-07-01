// Supabase Storage client for design attachments (files + standalone HTML
// exports). Server-only — uses the service role key, so it must never be
// imported into client components.

import { createClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "design-attachments";

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — see .env.example."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Kind is derived from the filename so standalone HTML exports get a preview action. */
export function attachmentKind(filename: string, mimeType: string): "file" | "html" {
  return filename.toLowerCase().endsWith(".html") || mimeType === "text/html"
    ? "html"
    : "file";
}

export async function uploadAttachment(designId: string, file: File) {
  const sb = client();
  const path = `${designId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await sb.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export async function deleteAttachment(path: string) {
  const sb = client();
  await sb.storage.from(BUCKET).remove([path]);
}
