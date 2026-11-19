"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteMessage } from "@/lib/format";
import { useToast } from "@/components/toast";
import { ProductForm, type ProductFormInitial } from "@/components/product/product-form";
import { deleteProductAction, productUpcomingCountAction } from "@/app/(app)/products/actions";

/** /products/:id — edit name, barcode, nutrition and portions; delete. */
export function ProductEdit({ initial }: { initial: ProductFormInitial }) {
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
      router.push("/library/products");
    });
  }

  return (
    <ProductForm
      initial={initial}
      onCancel={() => router.back()}
      onSaved={(p) => {
        toast.show({ message: `Saved ${p.name}` });
        router.push("/library/products");
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
