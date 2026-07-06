import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, hasWorkspaceAccess } from "@/lib/auth";
import { currentRole } from "@/lib/access";
import { logout } from "./actions";
import ManageNav from "@/components/ManageNav";

export default async function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const role = await currentRole();
  if (!hasWorkspaceAccess(role)) redirect("/");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
                DS
              </span>
              <span className="text-lg font-bold tracking-tight">
                Sobrus<span className="text-brand-600"> DS</span>
              </span>
            </Link>
            <span className="badge bg-slate-100 text-slate-500">Workspace</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden text-sm font-medium text-slate-500 hover:text-slate-800 sm:block"
            >
              View site ↗
            </Link>
            <span className="hidden text-sm text-slate-600 sm:block">
              {session?.name}
            </span>
            <form action={logout}>
              <button className="btn-secondary btn-sm">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-8 sm:px-6">
        <aside className="hidden w-52 shrink-0 lg:block">
          <ManageNav isAdmin={role === "admin"} />
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mb-6 lg:hidden">
            <ManageNav isAdmin={role === "admin"} />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
