import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { getLinearViewer } from "@/lib/linear";
import LinearSettings from "@/components/LinearSettings";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login?from=/manage/settings");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { linearApiKey: true },
  });

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

      <div className="mt-6">
        <LinearSettings
          connected={!!key}
          viewerLabel={viewer ? `${viewer.name} (${viewer.email})` : null}
        />
      </div>
    </div>
  );
}
