import type { FrozenReceiptData } from "@/lib/printing/types";
import { buildFrozenReceiptLayout } from "@/lib/printing/receipt-layout";
import { PaperView } from "./paper-view";

// On-screen preview of "BUKTI PENGAMBILAN/PEMBAYARAN FROZEN" — same
// single-source layout as the struk (see receipt-layout.ts).
export function FrozenReceiptView({ data }: { data: FrozenReceiptData }) {
  return <PaperView lines={buildFrozenReceiptLayout(data)} />;
}
