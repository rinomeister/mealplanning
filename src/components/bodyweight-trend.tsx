"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { kgToDisplay, weightLabel, type UnitSystem } from "@/lib/units";
import { formatHuman } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type TrendPoint = {
  date: string; // yyyy-MM-dd
  weightKg: number;
};

/**
 * A read-only glance at bodyweight: the latest reading, the change across the
 * window shown, and a compact sparkline. Logging and editing live on the
 * profile page — this is just the "where am I trending" view for the dashboard.
 */
export function BodyweightTrend({
  points,
  units,
}: {
  points: TrendPoint[];
  units: UnitSystem;
}) {
  const label = weightLabel(units);
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const first = sorted[0];

  if (!latest) {
    return (
      <p className="text-sm text-muted-foreground">
        No entries yet — log your weight on the Profile tab to see your trend.
      </p>
    );
  }

  const deltaKg = sorted.length >= 2 ? latest.weightKg - first.weightKg : null;
  const deltaDisplay =
    deltaKg != null ? kgToDisplay(Math.abs(deltaKg), units) : null;
  const down = deltaKg != null && deltaKg < -0.0001;
  const up = deltaKg != null && deltaKg > 0.0001;

  const chartData = sorted.map((p) => ({
    date: p.date.slice(5), // MM-DD
    weight: kgToDisplay(p.weightKg, units),
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold tabular-nums">
          {kgToDisplay(latest.weightKg, units)}{" "}
          <span className="text-lg font-medium text-muted-foreground">
            {label}
          </span>
        </span>
        {deltaKg != null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-sm font-medium",
              down && "text-primary",
              up && "text-muted-foreground",
              !down && !up && "text-muted-foreground",
            )}
          >
            {down ? (
              <TrendingDown className="size-4" />
            ) : up ? (
              <TrendingUp className="size-4" />
            ) : (
              <Minus className="size-4" />
            )}
            {down || up ? `${deltaDisplay} ${label}` : "no change"}
          </span>
        )}
      </div>

      {chartData.length >= 2 ? (
        <>
          <div className="h-24 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <YAxis domain={["auto", "auto"]} hide />
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
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground">
            Since {formatHuman(first.date)}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Log another entry to see your trend.
        </p>
      )}
    </div>
  );
}
