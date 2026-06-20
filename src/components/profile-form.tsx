"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateProfileAction } from "@/app/(app)/profile/actions";
import type { UnitSystem } from "@/lib/units";

export type ProfileInitial = {
  name: string;
  heightCm: string;
  targetKcal: string;
  targetProtein: string;
  targetFat: string;
  targetCarbs: string;
  units: UnitSystem;
};

export function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(initial);

  function set<K extends keyof ProfileInitial>(key: K, value: ProfileInitial[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateProfileAction(form);
      if (res.ok) setSaved(true);
      else setError(res.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Profile &amp; goals</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="units">Units</Label>
              <Select
                id="units"
                value={form.units}
                onChange={(e) => set("units", e.target.value as UnitSystem)}
              >
                <option value="METRIC">Metric (kg)</option>
                <option value="IMPERIAL">Imperial (lb)</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="heightCm">Height (cm)</Label>
              <Input
                id="heightCm"
                value={form.heightCm}
                onChange={(e) => set("heightCm", e.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Daily targets (optional)</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="kcal" value={form.targetKcal} onChange={(v) => set("targetKcal", v)} />
              <Field label="Protein g" value={form.targetProtein} onChange={(v) => set("targetProtein", v)} />
              <Field label="Fat g" value={form.targetFat} onChange={(v) => set("targetFat", v)} />
              <Field label="Carbs g" value={form.targetCarbs} onChange={(v) => set("targetCarbs", v)} />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              Save
            </Button>
            {saved && <span className="text-sm text-primary">Saved ✓</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" placeholder="0" />
    </div>
  );
}
