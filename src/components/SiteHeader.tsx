import Link from "next/link";
import { getSession } from "@/lib/auth";
import LinearFinder from "./LinearFinder";

export default async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="surface-blur sticky top-0 z-30">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm shadow-brand-600/30 transition group-hover:scale-105">
            DS
          </span>
          <span className="text-lg font-bold tracking-tight">
            Sobrus<span className="text-brand-600"> DS</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Solutions
          </Link>
          <LinearFinder />
          {session ? (
            <Link href="/manage" className="btn-primary btn-sm sm:px-4 sm:py-2.5">
              Designer workspace
            </Link>
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
