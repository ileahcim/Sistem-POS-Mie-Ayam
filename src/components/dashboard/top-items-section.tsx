import type { TopItemRow } from "@/lib/dashboard/aggregate-sales";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { PriceText } from "@/components/ui/price-text";

function ItemList({ title, items }: { title: string; items: TopItemRow[] }) {
  return (
    <div>
      <h3 className="text-ink-muted mb-1.5 text-sm font-bold uppercase tracking-wide">{title}</h3>
      <Card>
        {items.length === 0 ? (
          <p className="text-ink-faint py-8 text-center text-sm">Belum ada penjualan.</p>
        ) : (
          items.map((item, i) => (
            <ListRow key={item.name}>
              <span className="text-ink-faint w-5 shrink-0 text-sm">{i + 1}</span>
              <span className="text-ink flex-1 text-sm font-semibold">{item.name}</span>
              <span className="text-ink-muted w-16 shrink-0 text-right text-sm">{item.qty}x</span>
              <PriceText amount={item.omzet} weight="secondary" />
            </ListRow>
          ))
        )}
      </Card>
    </div>
  );
}

// Section 3 — top products and top toppings, ranked independently by qty
// sold over the shared date-range filter (not the same as Tahap 10's combo
// shortcuts, which rank whole product+addon combinations).
export function TopItemsSection({
  products,
  toppings,
  rangeLabel,
}: {
  products: TopItemRow[];
  toppings: TopItemRow[];
  rangeLabel: string;
}) {
  return (
    <section>
      <h2 className="text-ink mb-2 text-base font-bold">Menu & Topping Terlaris ({rangeLabel})</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ItemList title="Menu" items={products} />
        <ItemList title="Topping" items={toppings} />
      </div>
    </section>
  );
}
