import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { parseShareCode } from "@/lib/share";

/**
 * Type in (or paste) a meal share code. A valid code goes straight to its
 * preview page; anything else re-renders this form with an error.
 */
export default async function ImportByCodePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  await requireUserId();
  const { code: raw } = await searchParams;
  const code = raw ? parseShareCode(raw) : null;
  if (code) redirect(`/import/${code}`);

  return (
    <div className="desk:mx-auto desk:max-w-2xl">
      <PageHeader
        title="Import a meal"
        description="Got a share code from someone? Enter it to preview their meal."
      />
      <Card>
        <CardContent>
          <form action="/import" className="flex flex-col gap-3">
            <Label htmlFor="share-code">Share code or link</Label>
            <Input
              id="share-code"
              name="code"
              defaultValue={raw ?? ""}
              placeholder="e.g. K7QM-4XPA"
              autoComplete="off"
              autoCapitalize="characters"
              autoFocus
              className="font-mono text-lg tracking-widest"
            />
            {raw && (
              <p className="text-sm text-destructive">
                That doesn&apos;t look like a share code — it&apos;s 8 letters and numbers.
              </p>
            )}
            <Button type="submit">Find meal</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
