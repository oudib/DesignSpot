import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { getLinearViewer } from "@/lib/linear";
import LinearSettings from "@/components/LinearSettings";
import ApiKeySettings from "@/components/ApiKeySettings";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login?from=/manage/settings");

  const [user, apiKeys] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { linearApiKey: true },
    }),
    prisma.apiKey.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        prefix: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    }),
  ]);

  const key = decryptSecret(user?.linearApiKey);
  // Live-validate the saved key so the page can show who it's connected as
  // (or flag that a saved key has stopped working).
  const viewer = key ? await getLinearViewer(key) : null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">
        Personal integrations for your account.
      </p>

      <div className="mt-6 space-y-6">
        <LinearSettings
          connected={!!key}
          viewerLabel={viewer ? `${viewer.name} (${viewer.email})` : null}
        />
        <ApiKeySettings
          baseUrl={(process.env.APP_BASE_URL ?? "").replace(/\/+$/, "")}
          keys={apiKeys.map((k) => ({
            id: k.id,
            name: k.name,
            prefix: k.prefix,
            createdAt: k.createdAt.toISOString(),
            lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
            revokedAt: k.revokedAt?.toISOString() ?? null,
          }))}
        />
      </div>
    </div>
  );
}
