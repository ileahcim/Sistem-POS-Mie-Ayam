import type { PackingListData } from "@/lib/printing/types";
import { buildPackingListLayout } from "@/lib/printing/receipt-layout";
import { PaperView } from "./paper-view";

// Packing checklist for Antar, printed before payment — no prices, no total.
// Same single-source layout as the struk (see receipt-layout.ts).
export function PackingListView({ data }: { data: PackingListData }) {
  return <PaperView lines={buildPackingListLayout(data)} />;
}
