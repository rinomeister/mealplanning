import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Returns the current user's id, redirecting to /login if not authenticated.
 * Use at the top of every protected server component / server action.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

export async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}
