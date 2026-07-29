// Revision chains for design attachments. A redesign is uploaded as v2/v3… of
// the same deliverable, so a preview link shared in a Linear comment keeps
// resolving to the newest version instead of freezing on the first upload.
//
// Pure helpers — safe to import from client components.

/** The minimum an attachment needs for chain maths. */
export type RevisionLike = {
  id: string;
  version: number;
  rootId: string | null;
};

/** Id shared by every version of one deliverable (the first version's id). */
export function chainRootId<T extends RevisionLike>(attachment: T): string {
  return attachment.rootId ?? attachment.id;
}

/** Every version of the deliverable `attachment` belongs to, oldest first. */
export function chainOf<T extends RevisionLike>(
  attachment: T,
  all: T[]
): T[] {
  const root = chainRootId(attachment);
  return all
    .filter((a) => chainRootId(a) === root)
    .sort((a, b) => a.version - b.version);
}

/** The newest version in `attachment`'s chain (itself when it's the only one). */
export function latestOf<T extends RevisionLike>(attachment: T, all: T[]): T {
  const chain = chainOf(attachment, all);
  return chain[chain.length - 1] ?? attachment;
}

/**
 * Collapse a flat attachment list to one entry per deliverable — the newest
 * version, plus its full history. Order follows each chain's first upload, so
 * a revision doesn't make a deliverable jump to the bottom of the list.
 */
export function groupRevisions<T extends RevisionLike>(
  attachments: T[]
): { latest: T; versions: T[] }[] {
  const chains = new Map<string, T[]>();
  for (const a of attachments) {
    const root = chainRootId(a);
    const list = chains.get(root);
    if (list) list.push(a);
    else chains.set(root, [a]);
  }
  return Array.from(chains.values()).map((list) => {
    const versions = [...list].sort((a, b) => a.version - b.version);
    return { latest: versions[versions.length - 1], versions };
  });
}
