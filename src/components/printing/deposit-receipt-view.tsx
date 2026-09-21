import type { DepositReceiptData } from "@/lib/printing/types";
import { buildDepositReceiptLayout } from "@/lib/printing/receipt-layout";
import { PaperView } from "./paper-view";

// On-screen preview of the "BUKTI UANG MUKA" — same single-source layout as the
// struk (see receipt-layout.ts), so the preview and the paper cannot drift.
export function DepositReceiptView({ data }: { data: DepositReceiptData }) {
  return <PaperView lines={buildDepositReceiptLayout(data)} />;
}
