import type { AdminCategory, AdminAddonGroup } from "@/lib/menu/get-menu-admin-data";
import type { BaksoUsageSettingValues } from "@/lib/dashboard/bakso-usage";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import type { MieProductDefaults } from "@/lib/mie/get-mie-product-defaults";
import type { MieSpecialPriceRow } from "@/lib/mie/get-mie-customer-prices";
import { MIE_FIXED_PRODUCT_TYPES, MIE_PASAR_LABEL, MIE_PRODUCT_LABEL } from "@/lib/mie/types";
import Link from "next/link";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/ui/app-header";
import { MiePriceRow } from "./mie-price-row";
import { MieSpecialPriceSection } from "./mie-special-price-section";
import { ProductAdminRow } from "./product-admin-row";
import { NewProductForm } from "./new-product-form";
import { AddonOptionAdminRow } from "./addon-option-admin-row";
import { NewAddonOptionForm } from "./new-addon-option-form";
import { BaksoUsageSettingsForm } from "./bakso-usage-section";

// Server-renderable shell, same split as HppScreen — only the per-row
// editors need "use client". Two sections mirroring how the owner already
// thinks about the menu (CLAUDE.md "Manajemen Menu"): Produk by Category,
// then Add-on by AddonGroup. Creating a brand-new AddonGroup is out of
// scope here — see actions.ts's doc comment.
//
// "Mi Mentah" is THE place for every Note sale price (2 Nov 2026 — the old
// /note/produk page now redirects here): default Rp/kg per jenis, Mi Pasar,
// "Harga Khusus Pelanggan" (MieCustomerPrice), and the Frozen Rp/pcs. Modal
// per kg lives in Isi HPP. It re-uses the Note module's own data/actions
// (MiePriceRow -> updateMieProductDefault / updateMiePasarPrice /
// updateFrozenPrice; setMieCustomerPrices) and never creates products or
// touches the cashier — the Note books stay a separate module.
//
// The page is long and Mi Mentah sits at the bottom, so a row of jump links
// opens the page (and /admin/menu#mi-mentah lands straight on it).
const JUMP_LINKS = [
  { id: "produk", label: "Produk" },
  { id: "add-on", label: "Add-on" },
  { id: "perkiraan-bakso", label: "Perkiraan Bakso" },
  { id: "mi-mentah", label: "Mi Mentah" },
];

export function MenuAdminScreen({
  categories,
  addonGroups,
  baksoUsage,
  mieDefaults,
  miePasarPricePerKg,
  frozenPricePerPcs,
  specialPrices,
  mieCustomers,
  backHref,
  nav,
}: {
  categories: AdminCategory[];
  addonGroups: AdminAddonGroup[];
  baksoUsage: BaksoUsageSettingValues;
  mieDefaults: MieProductDefaults;
  miePasarPricePerKg: number | null;
  frozenPricePerPcs: number | null;
  specialPrices: MieSpecialPriceRow[];
  mieCustomers: { id: string; name: string }[];
  backHref: string;
  nav: HeaderNav;
}) {
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));
  const addonGroupOptions = addonGroups.map((g) => ({ id: g.id, name: g.name }));

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader
        nav={nav}
        title="Manajemen Menu"
        actions={
          <LinkButton href={backHref} variant="secondary" size="compact">
            Kembali
          </LinkButton>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <p className="text-ink-muted text-sm">
            Tambah, ubah, atau nonaktifkan produk dan add-on sendiri, tanpa lewat developer. HPP/modal tetap diisi di
            halaman &ldquo;Isi HPP&rdquo;.
          </p>

          <nav aria-label="Lompat ke bagian" className="flex flex-wrap gap-2">
            {JUMP_LINKS.map((j) => (
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

          <section id="produk" className="flex scroll-mt-4 flex-col gap-2">
            <h2 className="text-ink text-base font-bold">Produk</h2>
            {categories.map((category) => (
              <div key={category.id} className="flex flex-col gap-1">
                <h3 className="text-ink-muted text-sm font-bold uppercase tracking-wide">{category.name}</h3>
                <Card>
                  {category.products.length === 0 ? (
                    <p className="text-ink-faint px-3 py-4 text-sm">Belum ada produk.</p>
                  ) : (
                    category.products.map((product) => (
                      <ProductAdminRow
                        key={product.id}
                        product={product}
                        categories={categoryOptions}
                        addonGroups={addonGroupOptions}
                      />
                    ))
                  )}
                </Card>
              </div>
            ))}
            <NewProductForm categories={categoryOptions} addonGroups={addonGroupOptions} />
          </section>

          <section id="add-on" className="flex scroll-mt-4 flex-col gap-2">
            <h2 className="text-ink text-base font-bold">Add-on</h2>
            {addonGroups.map((group) => (
              <div key={group.id} className="flex flex-col gap-1">
                <h3 className="text-ink-muted text-sm font-bold uppercase tracking-wide">{group.name}</h3>
                <Card>
                  {group.options.length === 0 ? (
                    <p className="text-ink-faint px-3 py-4 text-sm">Belum ada opsi.</p>
                  ) : (
                    group.options.map((option) => <AddonOptionAdminRow key={option.id} option={option} />)
                  )}
                  <div className="border-border border-t">
                    <NewAddonOptionForm addonGroupId={group.id} />
                  </div>
                </Card>
              </div>
            ))}
            <p className="text-ink-faint text-xs">
              Grup add-on baru (kategori kustomisasi yang benar-benar baru) belum bisa dibuat sendiri di sini — hubungi
              developer untuk itu.
            </p>
          </section>

          <div id="perkiraan-bakso" className="scroll-mt-4">
            <BaksoUsageSettingsForm initial={baksoUsage} />
          </div>

          <section id="mi-mentah" className="flex scroll-mt-4 flex-col gap-3" data-testid="mi-mentah-section">
            <div>
              <h2 className="text-ink text-base font-bold">Mi Mentah</h2>
              <p className="text-ink-muted text-sm">
                Tempat mengatur harga jual Note. Pesanan Baru memakai <strong>harga khusus</strong> pelanggan kalau
                ada, kalau tidak <strong>harga default</strong> di bawah. &ldquo;Ubah harga&rdquo; di form pesanan
                hanya berlaku untuk pesanan itu. Modal per kg diisi di{" "}
                <Link href="/admin/hpp#mi-mentah" className="text-primary font-semibold underline">
                  Isi HPP
                </Link>
                .
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-ink-muted text-sm font-bold uppercase tracking-wide">Harga default per kg</h3>
              <Card>
                {MIE_FIXED_PRODUCT_TYPES.map((type) => (
                  <MiePriceRow
                    key={type}
                    target={{ kind: "default", productType: type }}
                    label={MIE_PRODUCT_LABEL[type]}
                    value={mieDefaults[type]}
                  />
                ))}
                <MiePriceRow
                  target={{ kind: "pasar" }}
                  label={MIE_PASAR_LABEL}
                  hint={`${MIE_PRODUCT_LABEL.MIE_KERITING} untuk pasar — tombol "Mi Pasar" di form pesanan. Tidak ada harga khusus per pelanggan.`}
                  value={miePasarPricePerKg}
                />
              </Card>
            </div>

            <MieSpecialPriceSection rows={specialPrices} customers={mieCustomers} defaults={mieDefaults} />

            <div className="flex flex-col gap-1">
              <h3 className="text-ink-muted text-sm font-bold uppercase tracking-wide">Mi Frozen</h3>
              <Card>
                <MiePriceRow
                  target={{ kind: "frozenPrice" }}
                  label="Frozen"
                  hint="Harga default per pcs — form Pengambilan Frozen"
                  value={frozenPricePerPcs}
                />
              </Card>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
