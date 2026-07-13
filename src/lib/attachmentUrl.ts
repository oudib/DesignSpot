// Pure helper, safe for client components (unlike lib/storage.ts).

function driveId(url: string): string {
  return url.split("/api/files/").pop()!;
}

/** Given an attachment's `/api/files/{driveId}` URL, build the in-app preview page URL. */
export function attachmentPreviewUrl(url: string): string {
  return `/preview/${driveId(url)}`;
}

/** Given an attachment's `/api/files/{driveId}` URL, build the Google Drive view URL. */
export function attachmentDriveUrl(url: string): string {
  return `https://drive.google.com/file/d/${driveId(url)}/view`;
}
