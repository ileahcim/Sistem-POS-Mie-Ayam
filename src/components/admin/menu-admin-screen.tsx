import type { AdminCategory, AdminAddonGroup } from "@/lib/menu/get-menu-admin-data";
import type { BaksoUsageSettingValues } from "@/lib/dashboard/bakso-usage";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import type { MieProductDefaults } from "@/lib/mie/get-mie-product-defaults";
import { MIE_FIXED_PRODUCT_TYPES, MIE_PASAR_LABEL, MIE_PRODUCT_LABEL } from "@/lib/mie/types";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/ui/app-header";
import { MieProductDefaultRow } from "@/components/note/mie-product-default-row";
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
// "Mi Mentah" and "Mi Frozen" are price sections only — they re-use the
// Note module's own rows/actions (MieProductDefaultRow -> updateMieProductDefault
// / updateMiePasarPrice / updateFrozenPrice, data from MieProductDefault /
// MieSetting). They do NOT create products/categories/add-ons and never touch
// the cashier: the Note books stay a separate module. See CLAUDE.md.
export function MenuAdminScreen({
  categories,
  addonGroups,
  baksoUsage,
  mieDefaults,
  miePasarPricePerKg,
  frozenPricePerPcs,
  nav,
}: {
  categories: AdminCategory[];
  addonGroups: AdminAddonGroup[];
  baksoUsage: BaksoUsageSettingValues;
  mieDefaults: MieProductDefaults;
  miePasarPricePerKg: number | null;
  frozenPricePerPcs: number | null;
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
          <LinkButton href="/admin/settings" variant="secondary" size="compact">
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

          <section className="flex flex-col gap-2">
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

          <section className="flex flex-col gap-2">
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

          <BaksoUsageSettingsForm initial={baksoUsage} />

          <section className="flex flex-col gap-2">
            <h2 className="text-ink text-base font-bold">Mi Mentah</h2>
            <p className="text-ink-muted text-sm">
              Harga jual default per kg — dipakai sebagai saran awal saat membuat pesanan baru di catatan Note, tetap
              bisa diubah per pelanggan saat itu juga.
            </p>
            <Card>
              {MIE_FIXED_PRODUCT_TYPES.map((type) => (
                <MieProductDefaultRow
                  key={type}
                  target={{ kind: "default", productType: type }}
                  label={MIE_PRODUCT_LABEL[type]}
                  defaultPricePerKg={mieDefaults[type]}
                />
              ))}
              <MieProductDefaultRow
                target={{ kind: "pasar" }}
                label={MIE_PASAR_LABEL}
                hint={`${MIE_PRODUCT_LABEL.MIE_KERITING} · tombol "Mi Pasar" di form pesanan`}
                defaultPricePerKg={miePasarPricePerKg}
              />
            </Card>

            <div className="mt-2 flex flex-col gap-1">
              <h3 className="text-ink-muted text-sm font-bold uppercase tracking-wide">Mi Frozen</h3>
              <Card>
                <MieProductDefaultRow
                  target={{ kind: "frozenPrice" }}
                  label="Frozen"
                  hint="Harga per pcs — form Pengambilan Frozen"
                  defaultPricePerKg={frozenPricePerPcs}
                />
              </Card>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
