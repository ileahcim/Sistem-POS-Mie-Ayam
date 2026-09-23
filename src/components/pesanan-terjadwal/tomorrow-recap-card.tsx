import type { TomorrowPreorderRecap } from "@/lib/orders/get-tomorrow-preorder-recap";
import { Card } from "@/components/ui/card";

// CLAUDE.md "Rekap Pre-order Besok", 24 Sep 2026 — server-rendered (no
// client interactivity needed), so the caller only renders this Card at all
// when recap is non-null (nothing due tomorrow: no empty section at all).
export function TomorrowRecapCard({ recap }: { recap: TomorrowPreorderRecap }) {
  return (
    <Card padded className="mb-3 flex flex-col gap-2">
      <h2 className="text-ink text-base font-bold">Rekap Pre-order Besok</h2>
      <p className="text-ink text-sm">
        {recap.products.map((p) => `${p.productName}: ${p.qty}`).join(", ")}
      </p>
      <div className="border-border flex flex-col gap-1 border-t pt-2">
        {recap.orders.map((o) => (
          <p key={o.id} className="text-ink-muted text-sm">
            {o.timeLabel} — {o.customerName ?? "(tanpa nama)"}
          </p>
        ))}
      </div>
    </Card>
  );
}
