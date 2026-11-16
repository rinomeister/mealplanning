"use client";

import Link from "next/link";
import { use, useActionState } from "react";
import { loginAction, type AuthState } from "../actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  // Set by the auth proxy when a signed-out visitor opened a protected page
  // (e.g. a meal share link), so they land back there after signing in.
  const { callbackUrl } = use(searchParams);
  const carry = callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : "";
  const [state, formAction] = useActionState<AuthState, FormData>(
    loginAction,
    undefined,
  );

  return (
    <Card>
      <CardContent className="pt-5">
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href={`/register${carry}`} className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
