"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

const OAUTH_ERRORS: Record<string, string> = {
  domain: "Only @sobrus.com Google accounts can sign in.",
  google: "Google sign-in failed. Please try again.",
  google_config: "Google sign-in isn't configured yet. Contact an admin.",
};

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28V6.63H1.29a12 12 0 0 0 0 10.74l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.35.6 4.6 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.63l3.98 3.09C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </svg>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const from = params.get("from") ?? "/";
  const oauthError = params.get("error");

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

        <a
          href={`/api/auth/google?from=${encodeURIComponent(from)}`}
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <GoogleIcon />
          Continue with Google
        </a>

        {oauthError && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {OAUTH_ERRORS[oauthError] ?? OAUTH_ERRORS.google}
          </p>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Only @sobrus.com Google accounts can sign in.
        </p>
      </div>
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
