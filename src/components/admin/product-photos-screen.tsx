import type { HeaderNav } from "@/lib/header/get-header-nav";
import { AppHeader } from "@/components/ui/app-header";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { ProductPhotoRow, type PhotoProduct } from "./product-photo-row";

export function ProductPhotosScreen({
  nav,
  categories,
}: {
  nav: HeaderNav;
  categories: { id: string; name: string; products: PhotoProduct[] }[];
}) {
  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader
        nav={nav}
        title="Foto Produk"
        actions={
          <LinkButton href="/admin/settings" variant="secondary" size="compact">
            Kembali
          </LinkButton>
        }
      />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <p className="text-ink-muted text-sm">
            Foto tampil di kartu produk layar Kasir. Produk tanpa foto memakai kotak warna dengan inisial namanya.
            Foto tampil utuh, tidak dipotong — sisa ruang diisi putih, jadi foto berlatar putih paling cocok. Ukurannya
            dikecilkan otomatis sebelum diunggah.
          </p>
          {categories
            .filter((c) => c.products.length > 0)
            .map((category) => (
              <section key={category.id} className="flex flex-col gap-2">
                <h2 className="text-ink text-sm font-bold">{category.name}</h2>
                <Card>
                  {category.products.map((product) => (
                    <ProductPhotoRow key={product.id} product={product} />
                  ))}
                </Card>
              </section>
            ))}
        </div>
      </div>
    </div>
  );
}
