"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TAG_COLORS } from "@/lib/default-tags";
import {
  createMealAction,
  createTagAction,
  updateMealAction,
} from "@/app/(app)/meals/actions";

type TagItem = { id: string; name: string; color: string | null };
type IngredientRow = { name: string; qty: string; unit: string; note: string };

export type MealFormInitial = {
  id: string;
  name: string;
  prepSteps: string;
  servingLabel: string;
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
  ingredients: IngredientRow[];
  tagIds: string[];
};

const emptyRow: IngredientRow = { name: "", qty: "", unit: "", note: "" };

export function MealForm({
  tags,
  initial,
}: {
  tags: TagItem[];
  initial?: MealFormInitial;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [servingLabel, setServingLabel] = useState(initial?.servingLabel ?? "");
  const [prepSteps, setPrepSteps] = useState(initial?.prepSteps ?? "");
  const [kcal, setKcal] = useState(initial?.kcal ?? "");
  const [protein, setProtein] = useState(initial?.protein ?? "");
  const [fat, setFat] = useState(initial?.fat ?? "");
  const [carbs, setCarbs] = useState(initial?.carbs ?? "");
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    initial?.ingredients?.length ? initial.ingredients : [{ ...emptyRow }],
  );

  const [allTags, setAllTags] = useState<TagItem[]>(tags);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initial?.tagIds ?? []),
  );
  const [newTag, setNewTag] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  function updateRow(i: number, patch: Partial<IngredientRow>) {
    setIngredients((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );
  }
  function addRow() {
    setIngredients((rows) => [...rows, { ...emptyRow }]);
  }
  function removeRow(i: number) {
    setIngredients((rows) =>
      rows.length === 1 ? [{ ...emptyRow }] : rows.filter((_, idx) => idx !== i),
    );
  }

  function toggleTag(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateTag() {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    setCreatingTag(true);
    const color = TAG_COLORS[allTags.length % TAG_COLORS.length];
    const res = await createTagAction(trimmed, color);
    setCreatingTag(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setAllTags((prev) =>
      prev.some((t) => t.id === res.id) ? prev : [...prev, res],
    );
    setSelected((prev) => new Set(prev).add(res.id));
    setNewTag("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanIngredients = ingredients
      .map((r) => ({
        name: r.name.trim(),
        qty: r.qty,
        unit: r.unit.trim(),
        note: r.note.trim(),
      }))
      .filter((r) => r.name.length > 0);

    const payload = {
      name: name.trim(),
      servingLabel,
      prepSteps,
      kcal,
      protein,
      fat,
      carbs,
      ingredients: cleanIngredients,
      tagIds: Array.from(selected),
    };

    if (!payload.name) {
      setError("Meal name is required.");
      return;
    }

    startTransition(async () => {
      const res = initial
        ? await updateMealAction(initial.id, payload)
        : await createMealAction(payload);
      // On success the action redirects; we only reach here on failure.
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Meal name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Overnight oats"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="servingLabel">One serving is… (optional)</Label>
            <Input
              id="servingLabel"
              value={servingLabel}
              onChange={(e) => setServingLabel(e.target.value)}
              placeholder="1 bowl"
            />
          </div>
        </CardContent>
      </Card>

      {/* Ingredients */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label>Ingredients</Label>
            <span className="text-xs text-muted-foreground">
              qty &amp; unit optional
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {ingredients.map((row, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-2">
                <div className="flex gap-2">
                  <Input
                    aria-label="Quantity"
                    value={row.qty}
                    onChange={(e) => updateRow(i, { qty: e.target.value })}
                    placeholder="500"
                    inputMode="decimal"
                    className="w-20"
                  />
                  <Input
                    aria-label="Unit"
                    value={row.unit}
                    onChange={(e) => updateRow(i, { unit: e.target.value })}
                    placeholder="ml"
                    className="w-20"
                  />
                  <Input
                    aria-label="Ingredient name"
                    value={row.name}
                    onChange={(e) => updateRow(i, { name: e.target.value })}
                    placeholder="milk"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(i)}
                    aria-label="Remove ingredient"
                  >
                    <X />
                  </Button>
                </div>
                <Input
                  aria-label="Note"
                  value={row.note}
                  onChange={(e) => updateRow(i, { note: e.target.value })}
                  placeholder="note (optional, e.g. semi-skimmed)"
                  className="text-xs"
                />
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus /> Add ingredient
          </Button>
        </CardContent>
      </Card>

      {/* Macros */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Label>Macros per serving (optional)</Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MacroInput label="kcal" value={kcal} onChange={setKcal} />
            <MacroInput label="Protein (g)" value={protein} onChange={setProtein} />
            <MacroInput label="Fat (g)" value={fat} onChange={setFat} />
            <MacroInput label="Carbs (g)" value={carbs} onChange={setCarbs} />
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {allTags.length === 0 && (
              <p className="text-sm text-muted-foreground">No tags yet.</p>
            )}
            {allTags.map((tag) => {
              const isOn = selected.has(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    isOn
                      ? "border-transparent text-white"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                  style={isOn ? { backgroundColor: tag.color ?? "#16a34a" } : undefined}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCreateTag();
                }
              }}
              placeholder="New tag name"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleCreateTag()}
              disabled={creatingTag || !newTag.trim()}
            >
              {creatingTag ? <Loader2 className="animate-spin" /> : <Plus />}
              Add tag
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Prep steps */}
      <Card>
        <CardContent className="flex flex-col gap-1.5">
          <Label htmlFor="prepSteps">Preparation (optional)</Label>
          <Textarea
            id="prepSteps"
            value={prepSteps}
            onChange={(e) => setPrepSteps(e.target.value)}
            placeholder={"Step 1: …\nStep 2: …"}
            rows={5}
          />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending} className="flex-1">
          {isPending && <Loader2 className="animate-spin" />}
          {initial ? "Save changes" : "Create meal"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function MacroInput({
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
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder="0"
      />
    </div>
  );
}
