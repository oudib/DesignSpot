// Symmetric encryption for secrets at rest (e.g. each designer's Linear key).
//
// AES-256-GCM with a key derived from AUTH_SECRET via scrypt. The stored value
// is "iv.tag.ciphertext", all base64url — self-contained, so rotating AUTH_SECRET
// invalidates old values (they fail to decrypt and are treated as "not set").
//
// Node-only — never import this into client components.

import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from "crypto";

const SECRET = process.env.AUTH_SECRET ?? "insecure-dev-secret-change-me";
// Fixed salt is fine here: AUTH_SECRET is the real secret and is per-deployment.
const KEY = scryptSync(SECRET, "sobrus-ds-secretbox", 32);

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ct].map((b) => b.toString("base64url")).join(".");
}

/** Decrypt a value produced by encryptSecret. Returns null on any failure. */
export function decryptSecret(blob: string | null | undefined): string | null {
  if (!blob) return null;
  try {
    const [ivB64, tagB64, ctB64] = blob.split(".");
    if (!ivB64 || !tagB64 || !ctB64) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      KEY,
      Buffer.from(ivB64, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const pt = Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64url")),
      decipher.final(),
    ]);
    return pt.toString("utf8");
  } catch {
    return null;
  }
}
