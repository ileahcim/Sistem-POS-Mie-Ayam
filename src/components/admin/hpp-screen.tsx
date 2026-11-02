import type { HppSection } from "@/lib/hpp/get-hpp-items";
import { summarizeHppSections } from "@/lib/hpp/get-hpp-items";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import type { MieCostKey, MieCosts } from "@/lib/mie/types";
import { MIE_COST_ROWS } from "@/lib/mie/types";
import type { MieProductDefaults } from "@/lib/mie/get-mie-product-defaults";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/ui/app-header";
import { LinkButton } from "@/components/ui/link-button";
import { HppItemRow } from "./hpp-item-row";
import { MiePriceRow } from "./mie-price-row";

// Server-renderable shell — only the per-row editor (hpp-item-row.tsx)
// needs "use client". Two top-level groupings mirror how the owner already
// thinks about the menu: Produk by Category, Add-on by AddonGroup.
//
// "Mi Mentah" at the bottom is THE place for the Note module's "Modal per
// kg" (MieProductDefault.costPerKg / MieSetting.pasarCostPerKg via
// updateMieCostPerKg) since 2 Nov 2026 — sale prices are in Manajemen Menu.
// Mi Frozen has no modal field, so it has no row here. Jump links on top,
// like Manajemen Menu (/admin/hpp#mi-mentah lands on it).
export function HppScreen({
  products,
  addons,
  mieCosts,
  mieDefaults,
  miePasarPricePerKg,
  backHref,
  nav,
}: {
  products: HppSection[];
  addons: HppSection[];
  mieCosts: MieCosts;
  mieDefaults: MieProductDefaults;
  miePasarPricePerKg: number | null;
  backHref: string;
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
          <LinkButton href={backHref} variant="secondary" size="compact">
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
          <nav aria-label="Lompat ke bagian" className="flex flex-wrap gap-2">
            {[
              { id: "produk", label: "Produk" },
              { id: "add-on", label: "Add-on" },
              { id: "mi-mentah", label: "Mi Mentah" },
            ].map((j) => (
              <a
                key={j.id}
                href={`#${j.id}`}
                className={
                  j.id === "mi-mentah"
                    ? "rounded-pill bg-primary flex h-12 items-center px-4 text-sm font-bold text-white"
                    : "rounded-pill bg-muted text-ink flex h-12 items-center px-4 text-sm font-semibold"
                }
              >
                {j.label}
              </a>
            ))}
          </nav>

          <section id="produk" className="scroll-mt-4">
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

          <section id="add-on" className="scroll-mt-4">
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

          <section id="mi-mentah" className="scroll-mt-4" data-testid="mi-mentah-cost-section">
            <h2 className="text-ink mb-2 text-base font-bold">Mi Mentah</h2>
            <p className="text-ink-muted mb-2 text-sm">
              Modal per kg bahan baku — angka tetap yang jarang berubah, dipakai menghitung Margin di Ringkasan Note
              (bukan HPP menu warung): (harga jual pesanan itu − modal) × kg. Mi Pasar punya modal sendiri karena
              resepnya beda. Harga jual diatur di{" "}
              <Link href="/admin/menu#mi-mentah" className="text-primary font-semibold underline">
                Manajemen Menu
              </Link>
              .
            </p>
            <Card>
              {MIE_COST_ROWS.map((row) => (
                <MiePriceRow
                  key={row.key}
                  target={{ kind: "cost", key: row.key }}
                  label={row.label}
                  value={mieCosts[row.key]}
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
