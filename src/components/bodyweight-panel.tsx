"use client";

import { useState, useTransition } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addBodyweightAction,
  deleteBodyweightAction,
} from "@/app/(app)/profile/actions";
import { displayToKg, kgToDisplay, weightLabel, type UnitSystem } from "@/lib/units";
import { formatHuman } from "@/lib/dates";

export type WeightLog = {
  id: string;
  recordedAt: string; // yyyy-MM-dd
  weightKg: number;
  note: string | null;
};

export function BodyweightPanel({
  logs,
  units,
  today,
}: {
  logs: WeightLog[];
  units: UnitSystem;
  today: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const label = weightLabel(units);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const val = Number(weight);
    if (!Number.isFinite(val) || val <= 0) {
      setError("Enter a valid weight.");
      return;
    }
    startTransition(async () => {
      const res = await addBodyweightAction({
        weightKg: displayToKg(val, units),
        recordedAt: date,
        note: note || undefined,
      });
      if (res.ok) {
        setWeight("");
        setNote("");
      } else {
        setError(res.error);
      }
    });
  }

  // Chart data ascending by date.
  const chartData = [...logs]
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .map((l) => ({
      date: l.recordedAt.slice(5), // MM-DD
      weight: kgToDisplay(l.weightKg, units),
    }));

  // List newest first.
  const listed = [...logs].sort((a, b) =>
    b.recordedAt.localeCompare(a.recordedAt),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Bodyweight</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="weight">Weight ({label})</Label>
            <Input
              id="weight"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className="w-24"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-40"
            />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            Log
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}

        {chartData.length >= 2 ? (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v) => [`${v} ${label}`, "Weight"]}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Log at least two entries to see your trend.
          </p>
        )}

        {listed.length > 0 && (
          <ul className="flex flex-col gap-1">
            {listed.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">
                  {formatHuman(l.recordedAt)}
                </span>
                <span className="ml-auto mr-3 font-medium tabular-nums">
                  {kgToDisplay(l.weightKg, units)} {label}
                </span>
                <DeleteWeight id={l.id} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DeleteWeight({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => {
        await deleteBodyweightAction(id);
      })}
      className="rounded p-1 text-muted-foreground hover:text-destructive"
      aria-label="Delete entry"
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}
