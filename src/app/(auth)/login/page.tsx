"use client";

import Link from "next/link";
import { use, useActionState } from "react";
import { loginAction, type AuthState } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { AppMark, PasswordField, authField } from "@/components/auth-ui";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  // Set by the auth proxy when a signed-out visitor opened a protected page
  // (e.g. a meal share link), so they land back there after signing in.
  const { callbackUrl } = use(searchParams);
  const carry = callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : "";
  const [state, formAction] = useActionState<AuthState, FormData>(loginAction, undefined);

  return (
    <form action={formAction} className="flex flex-1 flex-col">
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <div className="mt-[8vh] desk:mt-0">
        <AppMark />
        <h1 className="t-title mt-6 text-[32px] leading-[38px]">Welcome back</h1>
        <p className="mt-1 text-ink-2">Log in to see today&apos;s macros.</p>
      </div>
      <div className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[13px] font-semibold text-ink-2">
            Email
          </label>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" enterKeyHint="next" required className={authField} />
        </div>
        <PasswordField autoComplete="current-password" />
        {state?.error && (
          <p role="alert" className="text-sm text-bad">
            {state.error}
          </p>
        )}
      </div>
      <div className="mt-auto flex flex-col gap-3 pt-10 desk:mt-10">
        <SubmitButton size="lg" className="w-full" pendingText="Logging in…">
          Log in
        </SubmitButton>
        <p className="text-center text-ink-2">
          New here?{" "}
          <Link href={`/register${carry}`} className="inline-flex h-11 items-center font-semibold text-ink">
            Create an account
          </Link>
        </p>
      </div>
    </form>
  );
}
