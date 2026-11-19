"use client";

import Link from "next/link";
import { use, useActionState } from "react";
import { ChevronLeft } from "lucide-react";
import { registerAction, type AuthState } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { PasswordField, authField } from "@/components/auth-ui";

export default function RegisterPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  // Set by the auth proxy when a signed-out visitor opened a protected page
  // (e.g. a meal share link), so they land back there after signing in.
  const { callbackUrl } = use(searchParams);
  const carry = callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : "";
  const [state, formAction] = useActionState<AuthState, FormData>(registerAction, undefined);

  return (
    <form action={formAction} className="flex flex-1 flex-col">
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <Link href={`/login${carry}`} aria-label="Back to log in" className="-ml-2.5 grid size-11 place-items-center">
        <ChevronLeft className="size-6" />
      </Link>
      <h1 className="t-title mt-4 text-[32px] leading-[38px]">Create account</h1>
      <p className="mt-1 text-ink-2">You&apos;ll set calorie and macro targets next, or skip and use defaults.</p>
      <div className="mt-7 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-[13px] font-semibold text-ink-2">
            Name <span className="font-normal text-ink-3">(optional)</span>
          </label>
          <input id="name" name="name" type="text" autoComplete="name" enterKeyHint="next" className={authField} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[13px] font-semibold text-ink-2">
            Email
          </label>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" enterKeyHint="next" required className={authField} />
        </div>
        <PasswordField autoComplete="new-password" meter />
        {state?.error && (
          <p role="alert" className="text-sm text-bad">
            {state.error}
          </p>
        )}
      </div>
      <div className="mt-auto flex flex-col gap-3 pt-10 desk:mt-10">
        <SubmitButton size="lg" className="w-full" pendingText="Creating account…">
          Create account
        </SubmitButton>
        <p className="text-center text-ink-2">
          Have an account?{" "}
          <Link href={`/login${carry}`} className="inline-flex h-11 items-center font-semibold text-ink">
            Log in
          </Link>
        </p>
      </div>
    </form>
  );
}
