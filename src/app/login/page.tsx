"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { login, type LoginState } from "./actions";

function LoginForm() {
  const params = useSearchParams();
  const from = params.get("from") ?? "/manage";
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    {}
  );

  return (
    <div className="w-full max-w-sm">
      <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white">
          DS
        </span>
        <span className="text-xl font-bold tracking-tight">
          Sobrus<span className="text-brand-600"> DS</span>
        </span>
      </Link>

      <div className="card p-8">
        <h1 className="text-xl font-bold tracking-tight">Designer sign in</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sign in to manage tickets and designs.
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          <input type="hidden" name="from" value={from} />
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue="designer@sobrus.com"
              className="input"
              placeholder="you@sobrus.com"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="input"
              placeholder="••••••••"
            />
          </div>

          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          )}

          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        Demo: designer@sobrus.com · sobrus123
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={<div className="text-slate-400">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
