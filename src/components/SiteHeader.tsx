import Link from "next/link";
import { getSession, hasWorkspaceAccess } from "@/lib/auth";
import { currentRole } from "@/lib/access";
import { logout } from "@/app/manage/actions";
import LinearFinder from "./LinearFinder";

export default async function SiteHeader() {
  const session = await getSession();
  const role = session ? await currentRole() : null;

  return (
    <header className="sticky top-0 z-30 bg-midnight/90 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center transition hover:opacity-90">
          <img src="/logo-white.svg" alt="Sobrus Design" className="h-9 w-auto" />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Solutions
          </Link>
          <LinearFinder variant="dark" />
          {session && hasWorkspaceAccess(role) ? (
            <Link
              href="/manage"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 active:scale-[0.98] sm:px-4 sm:py-2.5 sm:text-sm"
            >
              Designer workspace
            </Link>
          ) : session ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-slate-400 sm:block">
                {session.name}
              </span>
              <form action={logout}>
                <button className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20 sm:py-2.5 sm:text-sm">
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20 sm:px-4 sm:py-2.5 sm:text-sm"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
