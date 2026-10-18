// Personal API keys for /api/v1 (see prisma ApiKey). Node-only: uses crypto.
//
// Format: "sds_" + 40 base64url chars (30 random bytes). The plaintext is shown
// to the owner exactly once; the row keeps sha256(key) for lookup and the first
// 12 characters as a display prefix so keys can be told apart when revoking.

import { createHash, randomBytes } from "crypto";

export const API_KEY_PREFIX = "sds_";

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = API_KEY_PREFIX + randomBytes(30).toString("base64url");
  return { key, prefix: displayPrefix(key), hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function displayPrefix(key: string): string {
  return key.slice(0, 12);
}

export function looksLikeApiKey(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX) && value.length > API_KEY_PREFIX.length + 20;
}
