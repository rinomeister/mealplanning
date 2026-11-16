"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/schemas";
import { DEFAULT_TAGS } from "@/lib/default-tags";

export type AuthState = { error?: string } | undefined;

/**
 * Where to go after signing in. Only ever a path on this site: the proxy hands
 * us an absolute URL, so keep just its path + query and refuse anything that
 * isn't a plain local path (no "//evil.example" tricks).
 */
function safeRedirect(raw: FormDataEntryValue | null): string {
  if (typeof raw !== "string" || !raw) return "/";
  try {
    const url = new URL(raw, "http://local.invalid");
    const path = url.pathname + url.search;
    if (!path.startsWith("/") || path.startsWith("//")) return "/";
    if (path.startsWith("/login") || path.startsWith("/register")) return "/";
    return path;
  } catch {
    return "/";
  }
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: safeRedirect(formData.get("callbackUrl")),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    // Re-throw redirect (NEXT_REDIRECT) and anything unexpected.
    throw error;
  }
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      name: name ?? null,
      passwordHash,
      tags: { create: DEFAULT_TAGS },
    },
  });

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: safeRedirect(formData.get("callbackUrl")),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created — please log in." };
    }
    throw error;
  }
}
