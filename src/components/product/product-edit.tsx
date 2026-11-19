"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteMessage } from "@/lib/format";
import { useToast } from "@/components/toast";
import { ProductForm, type ProductFormInitial } from "@/components/product/product-form";
import { InlineFlowProvider } from "@/components/add/flow-screen";
import { deleteProductAction, productUpcomingCountAction } from "@/app/(app)/products/actions";

/**
 * /products/:id — edit name, barcode, nutrition and portions; delete.
 * With onDone it sits in the desktop Library pane instead of its own page.
 */
export function ProductEdit({ initial, onDone }: { initial: ProductFormInitial; onDone?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [deleting, startDelete] = useTransition();

  function remove() {
    startDelete(async () => {
      const upcoming = await productUpcomingCountAction(initial.id);
      if (!confirm(deleteMessage(`“${initial.name}”`, upcoming))) return;
      const res = await deleteProductAction(initial.id);
      if (!res.ok) {
        toast.show({ message: res.error, tone: "error" });
        return;
      }
      toast.show({ message: `Deleted ${initial.name}` });
      if (onDone) onDone();
      else router.push("/library/products");
    });
  }

  return (
    <ProductForm
      initial={initial}
      onCancel={() => (onDone ? onDone() : router.back())}
      onSaved={(p) => {
        toast.show({ message: `Saved ${p.name}` });
        if (onDone) router.refresh();
        else router.push("/library/products");
      }}
      footer={
        <div className="flex flex-col gap-2 pt-2">
          <p className="text-[13px] text-ink-3">
            Changes apply to today and upcoming days. Past days keep what was logged.
          </p>
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="press flex h-12 items-center justify-center gap-2 rounded-[14px] border border-line font-semibold text-bad"
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete product
          </button>
        </div>
      }
    />
  );
}

/** Desktop Library: the editor in the pane beside the list. */
export function ProductPane({ initial }: { initial: ProductFormInitial }) {
  const router = useRouter();
  return (
    <InlineFlowProvider>
      <ProductEdit initial={initial} onDone={() => router.replace("/library/products", { scroll: false })} />
    </InlineFlowProvider>
  );
}
