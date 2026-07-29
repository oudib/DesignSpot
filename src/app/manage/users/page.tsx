import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, hasWorkspaceAccess } from "@/lib/auth";
import { currentRole } from "@/lib/access";
import { setWorkspaceAccess } from "./actions";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";

const ROLE_BADGES: Record<string, { label: string; className: string }> = {
  admin: { label: "Admin", className: "bg-brand-50 text-brand-700" },
  designer: { label: "Designer", className: "bg-emerald-50 text-emerald-700" },
  viewer: { label: "Viewer", className: "bg-slate-100 text-slate-500" },
};

export default async function UsersPage() {
  const session = await getSession();
  if ((await currentRole()) !== "admin") redirect("/manage");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const withAccess = users.filter((u) => hasWorkspaceAccess(u.role)).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Users & access</h1>
        <p className="mt-1 text-sm text-slate-500">
          Everyone signs in with their @sobrus.com account and can browse the
          hub. Grant workspace access to let someone manage tickets and
          designs. {withAccess} of {users.length} users have access.
        </p>
      </div>

      <div className="card divide-y divide-slate-100">
        {users.map((user) => {
          const badge = ROLE_BADGES[user.role] ?? ROLE_BADGES.viewer;
          const isSelf = user.id === session?.userId;
          const canToggle = user.role !== "admin" && !isSelf;
          const hasAccess = hasWorkspaceAccess(user.role);

          return (
            <div
              key={user.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {user.name}
                  {isSelf && (
                    <span className="ml-1.5 text-xs font-normal text-slate-400">
                      (you)
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
              <span className={`badge ${badge.className}`}>{badge.label}</span>
              <span className="hidden text-xs text-slate-400 sm:block">
                Joined{" "}
                {user.createdAt.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              {canToggle ? (
                <ActionForm
                  action={setWorkspaceAccess}
                  success={
                    hasAccess
                      ? `Workspace access revoked for ${user.name}.`
                      : `Workspace access granted to ${user.name}.`
                  }
                  error="Couldn't change workspace access. Please try again."
                >
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="grant" value={hasAccess ? "0" : "1"} />
                  <SubmitButton
                    className={hasAccess ? "btn-secondary btn-sm" : "btn-primary btn-sm"}
                    pendingLabel={hasAccess ? "Revoking…" : "Granting…"}
                  >
                    {hasAccess ? "Revoke workspace" : "Grant workspace"}
                  </SubmitButton>
                </ActionForm>
              ) : (
                <span className="text-xs text-slate-400">
                  {user.role === "admin" ? "Always has access" : ""}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Admins are set via the <code>ADMIN_EMAILS</code> environment variable
        and promoted automatically when they sign in with Google.
      </p>
    </div>
  );
}
