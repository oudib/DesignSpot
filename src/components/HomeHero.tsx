import Link from "next/link";
import { getSession, hasWorkspaceAccess } from "@/lib/auth";
import { currentRole } from "@/lib/access";
import { logout } from "@/app/manage/actions";
import LinearFinder from "./LinearFinder";
import HomeSearch from "./HomeSearch";
import DarkHero from "./DarkHero";
import SubmitButton from "./SubmitButton";

const TIMEZONE = "Africa/Casablanca";

type SolutionTab = { name: string; slug: string };

export default async function HomeHero({
  solutions,
}: {
  solutions: SolutionTab[];
}) {
  const session = await getSession();
  const role = session ? await currentRole() : null;

  const now = new Date();
  const weekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: TIMEZONE,
  }).format(now);
  const fullDate = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIMEZONE,
  }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: TIMEZONE,
    }).format(now)
  );
  const greeting =
    hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  const firstName = session?.name?.split(" ")[0];

  return (
    <DarkHero as="header" className="rounded-b-[2rem] sm:rounded-b-[2.75rem]">
      <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-28">
        {/* Top bar: logo, search, actions */}
        <div className="flex h-20 items-center justify-between gap-3">
          <Link
            href="/"
            className="flex shrink-0 items-center transition hover:opacity-90"
          >
            <img src="/logo-white.svg" alt="Sobrus Design" className="h-9 w-auto" />
          </Link>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="hidden w-64 md:block lg:w-80">
              <HomeSearch variant="dark" className="w-full" />
            </div>
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
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white ring-1 ring-inset ring-white/15">
                  {session.name?.charAt(0).toUpperCase()}
                </span>
                <form action={logout}>
                  <SubmitButton
                    className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-60 sm:py-2.5 sm:text-sm"
                    pendingLabel="Signing out…"
                  >
                    Sign out
                  </SubmitButton>
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
          </div>
        </div>

        {/* Greeting */}
        <div className="pt-6 sm:pt-10">
          <p className="text-sm font-medium text-slate-400">
            {weekday}, {fullDate}
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-5xl">
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-3 max-w-xl text-sm text-slate-400 sm:text-base">
            Explore every Sobrus solution — modules, flows and the latest
            designs, all in one place.
          </p>

          {/* Search moves below the greeting on small screens */}
          <div className="mt-6 md:hidden">
            <HomeSearch variant="dark" className="max-w-xl" />
          </div>
        </div>

        {/* Pill navigation */}
        <nav
          className="mt-8 flex items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Solutions"
        >
          <span className="whitespace-nowrap rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900 shadow-sm">
            Overview
          </span>
          {solutions.map((s) => (
            <Link
              key={s.slug}
              href={`/solutions/${s.slug}`}
              className="whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              {s.name}
            </Link>
          ))}
        </nav>
      </div>
    </DarkHero>
  );
}
