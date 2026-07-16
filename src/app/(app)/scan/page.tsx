import { requireUserId } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { BarcodeScanner } from "@/components/barcode-scanner";

export default async function ScanPage() {
  await requireUserId();

  return (
    <>
      <PageHeader
        title="Scan a product"
        description="Scan a barcode to look up its nutrition."
      />
      <BarcodeScanner />
    </>
  );
}
