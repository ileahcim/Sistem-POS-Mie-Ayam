import type { HppSection } from "@/lib/hpp/get-hpp-items";
import { summarizeHppSections } from "@/lib/hpp/get-hpp-items";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import type { MieCostKey, MieCosts } from "@/lib/mie/types";
import { MIE_COST_ROWS } from "@/lib/mie/types";
import type { MieProductDefaults } from "@/lib/mie/get-mie-product-defaults";
import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/ui/app-header";
import { LinkButton } from "@/components/ui/link-button";
import { HppItemRow } from "./hpp-item-row";
import { MieCostAdminRow } from "./mie-cost-admin-row";

// Server-renderable shell — only the per-row editor (hpp-item-row.tsx)
// needs "use client". Two top-level groupings mirror how the owner already
// thinks about the menu: Produk by Category, Add-on by AddonGroup.
//
// "Mi Mentah" at the bottom shows the Note module's own "Modal per kg"
// (MieProductDefault.costPerKg / MieSetting.pasarCostPerKg via
// updateMieCostPerKg) next to the warung HPP rows — same data as /note/produk,
// never a second copy. Mi Frozen has no modal field, so it has no row here.
export function HppScreen({
  products,
  addons,
  mieCosts,
  mieDefaults,
  miePasarPricePerKg,
  nav,
}: {
  products: HppSection[];
  addons: HppSection[];
  mieCosts: MieCosts;
  mieDefaults: MieProductDefaults;
  miePasarPricePerKg: number | null;
  nav: HeaderNav;
}) {
  const { missing, lowMargin } = summarizeHppSections([...products, ...addons]);

  // Basis untung "Modal per kg" is that jenis's default SALE price per kg:
  // Mi Pasar uses the market price, the rest use their own default.
  const mieSalePrice: Record<MieCostKey, number | null> = {
    MIE_KERITING: mieDefaults.MIE_KERITING,
    MIE_LURUS: mieDefaults.MIE_LURUS,
    PANGSIT: mieDefaults.PANGSIT,
    MIE_PASAR: miePasarPricePerKg,
  };

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader
        nav={nav}
        title="Isi HPP"
        actions={
          <LinkButton href="/admin/settings" variant="secondary" size="compact">
            Kembali
          </LinkButton>
        }
      />

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

          <section>
            <h2 className="text-ink mb-2 text-base font-bold">Mi Mentah</h2>
            <p className="text-ink-muted mb-2 text-sm">
              Modal per kg bahan baku — angka tetap yang jarang berubah, dipakai menghitung Margin di catatan Note
              (bukan HPP menu warung). Datanya sama dengan halaman Harga Produk.
            </p>
            <Card>
              {MIE_COST_ROWS.map((row) => (
                <MieCostAdminRow
                  key={row.key}
                  costKey={row.key}
                  label={row.label}
                  costPerKg={mieCosts[row.key]}
                  salePricePerKg={mieSalePrice[row.key]}
                />
              ))}
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
