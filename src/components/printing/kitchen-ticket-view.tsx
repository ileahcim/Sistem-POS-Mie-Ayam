import type { KitchenTicketData } from "@/lib/printing/types";
import { buildKitchenTicketLayout } from "@/lib/printing/receipt-layout";
import { PaperView } from "./paper-view";

// The kitchen ticket ("kertas dapur") — same single-source layout as the
// other three printouts (see receipt-layout.ts).
export function KitchenTicketView({ data }: { data: KitchenTicketData }) {
  return <PaperView lines={buildKitchenTicketLayout(data)} />;
}
