import type { ReceiptData } from "@/lib/printing/types";
import { buildReceiptLayout } from "@/lib/printing/receipt-layout";
import { PaperView } from "./paper-view";

// On-screen preview of the struk (the MockPrinter overlay). It is the
// reference for what the paper says — see receipt-layout.ts, which builds the
// line list that this and the ESC/POS renderer both read.
export function ReceiptView({ data }: { data: ReceiptData }) {
  return <PaperView lines={buildReceiptLayout(data)} />;
}
