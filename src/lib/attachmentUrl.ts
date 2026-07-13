// Pure helper, safe for client components (unlike lib/storage.ts).

/** Given an attachment's `/api/files/{driveId}` URL, build the in-app preview page URL. */
export function attachmentPreviewUrl(url: string): string {
  const driveId = url.split("/api/files/").pop();
  return `/preview/${driveId}`;
}
