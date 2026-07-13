import Link from "next/link";
import { getSession, hasWorkspaceAccess } from "@/lib/auth";
import { currentRole } from "@/lib/access";
import { logout } from "@/app/manage/actions";
import LinearFinder from "./LinearFinder";
import Logo from "@/components/Logo";

export default async function SiteHeader() {
  const session = await getSession();
  const role = session ? await currentRole() : null;

  return (
    <header className="surface-blur sticky top-0 z-30">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center transition hover:scale-105">
          <Logo className="h-9 w-auto" />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Solutions
          </Link>
          <LinearFinder />
          {session && hasWorkspaceAccess(role) ? (
            <Link href="/manage" className="btn-primary btn-sm sm:px-4 sm:py-2.5">
              Designer workspace
            </Link>
          ) : session ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-slate-500 sm:block">
                {session.name}
              </span>
              <form action={logout}>
                <button className="btn-secondary btn-sm">Sign out</button>
              </form>
            </div>
          ) : (
            <Link href="/login" className="btn-secondary btn-sm sm:px-4 sm:py-2.5">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
