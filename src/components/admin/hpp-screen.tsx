import type { HppSection } from "@/lib/hpp/get-hpp-items";
import { summarizeHppSections } from "@/lib/hpp/get-hpp-items";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/ui/app-header";
import { HppItemRow } from "./hpp-item-row";

// Server-renderable shell — only the per-row editor (hpp-item-row.tsx)
// needs "use client". Two top-level groupings mirror how the owner already
// thinks about the menu: Produk by Category, Add-on by AddonGroup.
export function HppScreen({
  products,
  addons,
  nav,
}: {
  products: HppSection[];
  addons: HppSection[];
  nav: HeaderNav;
}) {
  const { missing, lowMargin } = summarizeHppSections([...products, ...addons]);

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader nav={nav} title="Isi HPP" />

      {(missing > 0 || lowMargin > 0) && (
        <div className="border-border bg-surface flex flex-col gap-1 border-b px-4 py-3 text-sm">
          {missing > 0 && (
            <p className="text-warning font-medium">{missing} item HPP-nya belum diisi.</p>
          )}
          {lowMargin > 0 && (
            <p className="text-danger font-medium">
              {lowMargin} item margin di bawah 10% dan belum ditandai &ldquo;disengaja&rdquo;.
            </p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <section>
            <h2 className="text-ink mb-2 text-base font-bold">Produk</h2>
            <div className="flex flex-col gap-4">
              {products.map((section) => (
                <div key={section.title}>
                  <h3 className="text-ink-muted mb-1.5 text-sm font-bold uppercase tracking-wide">
                    {section.title}
                  </h3>
                  <Card>
                    {section.items.map((item) => (
                      <HppItemRow key={item.id} item={item} />
                    ))}
                  </Card>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-ink mb-2 text-base font-bold">Add-on</h2>
            <div className="flex flex-col gap-4">
              {addons.map((section) => (
                <div key={section.title}>
                  <h3 className="text-ink-muted mb-1.5 text-sm font-bold uppercase tracking-wide">
                    {section.title}
                  </h3>
                  <Card>
                    {section.items.map((item) => (
                      <HppItemRow key={item.id} item={item} />
                    ))}
                  </Card>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
