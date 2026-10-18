// Linear sync helpers shared by the /manage server actions and the /api/v1
// routes. Each designer connects their own Linear, so every push uses the
// ACTING user's decrypted Personal API key (comments are authored as them).
// All of these are best-effort: postLinearComment no-ops when the key is null
// and never throws, so awaiting them is safe anywhere.

import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { postLinearComment, flowUrl, statusMessage } from "@/lib/linear";

/** Decrypted Linear key for the acting user, or null if not connected. */
export async function actingLinearKey(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { linearApiKey: true },
  });
  return decryptSecret(user?.linearApiKey);
}

export async function linkFlowToLinear(
  apiKey: string | null,
  linearUrl: string,
  flowId: string
) {
  if (!apiKey || !linearUrl || !flowId) return;
  const flow = await prisma.flow.findUnique({ where: { id: flowId } });
  if (!flow) return;
  await postLinearComment(
    apiKey,
    linearUrl,
    `🔗 Linked design flow: **${flow.name}**\n${flowUrl(flowId)}`
  );
}

export async function announceStatus(
  apiKey: string | null,
  linearUrl: string,
  status: string
) {
  if (!apiKey || !linearUrl) return;
  const msg = statusMessage(status);
  if (msg) await postLinearComment(apiKey, linearUrl, msg);
}

// Compare a ticket's previous state to its new state and push only the events
// that actually changed: a freshly-attached/changed Linear link or flow gets a
// flow-link comment; a status change gets a status comment.
export async function syncTicketChanges(
  apiKey: string | null,
  prev: { linearUrl: string; flowId: string | null; status: string } | null,
  next: { linearUrl: string; flowId: string | null; status: string }
) {
  if (!apiKey || !next.linearUrl) return;
  const issueChanged = prev?.linearUrl !== next.linearUrl;
  const flowChanged = prev?.flowId !== next.flowId;
  if (next.flowId && (issueChanged || flowChanged)) {
    await linkFlowToLinear(apiKey, next.linearUrl, next.flowId);
  }
  if (issueChanged || prev?.status !== next.status) {
    await announceStatus(apiKey, next.linearUrl, next.status);
  }
}
