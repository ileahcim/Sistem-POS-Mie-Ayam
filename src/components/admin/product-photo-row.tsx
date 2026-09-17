"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { removeProductImage, uploadProductImage } from "@/app/admin/foto-produk/actions";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/ui/product-image";

export type PhotoProduct = { id: string; name: string; imageUrl: string | null };

const OUT_WIDTH = 800;
const OUT_HEIGHT = 600; // 4:3, same as the Kasir product card

// Center-crops to 4:3 and shrinks to 800×600 in the browser, so a 5 MB
// phone photo becomes a ~60-120 KB file before it's ever sent.
async function resizeToCard(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.max(OUT_WIDTH / bitmap.width, OUT_HEIGHT / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  const canvas = document.createElement("canvas");
  canvas.width = OUT_WIDTH;
  canvas.height = OUT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, (OUT_WIDTH - w) / 2, (OUT_HEIGHT - h) / 2, w, h);
  bitmap.close();
  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.82));
  // Browsers without WebP encoding silently hand back PNG — use JPEG then.
  const webp = await toBlob("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob("image/jpeg");
  if (!jpeg) throw new Error("encode");
  return jpeg;
}

export function ProductPhotoRow({ product }: { product: PhotoProduct }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy("upload");
    try {
      let blob: Blob;
      try {
        blob = await resizeToCard(file);
      } catch {
        setError("Foto tidak bisa dibaca. Coba file JPG atau PNG lain.");
        return;
      }
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      const form = new FormData();
      form.set("productId", product.id);
      form.set("file", new File([blob], `foto.${ext}`, { type: blob.type }));
      const result = await uploadProductImage(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1500);
      router.refresh();
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setError(null);
    setBusy("remove");
    try {
      const result = await removeProductImage(product.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirmRemove(false);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const inputId = `photo-${product.id}`;

  return (
    <div className="border-border flex flex-col gap-2 border-b p-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <ProductImage
          name={product.name}
          imageUrl={product.imageUrl}
          className="rounded-input aspect-[4/3] w-20 shrink-0"
          initialsClassName="text-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-ink truncate text-base font-semibold">{product.name}</p>
          <p className="text-ink-muted text-xs">
            {busy === "upload" ? "Mengunggah..." : savedFlash ? "Tersimpan ✓" : product.imageUrl ? "Pakai foto" : "Belum ada foto"}
          </p>
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={busy !== null}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <label
          htmlFor={inputId}
          className="rounded-pill bg-muted text-ink flex h-12 shrink-0 cursor-pointer items-center px-4 text-sm font-semibold whitespace-nowrap"
        >
          {product.imageUrl ? "Ganti foto" : "Unggah foto"}
        </label>
        {product.imageUrl && !confirmRemove && (
          <Button variant="danger" disabled={busy !== null} onClick={() => setConfirmRemove(true)}>
            Hapus
          </Button>
        )}
      </div>
      {confirmRemove && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-ink flex-1 text-sm">Hapus foto {product.name}? Kartu kembali ke kotak warna.</p>
          <Button variant="secondary" onClick={() => setConfirmRemove(false)}>
            Tidak jadi
          </Button>
          <Button variant="danger" disabled={busy !== null} onClick={handleRemove}>
            {busy === "remove" ? "Menghapus..." : "Ya, Hapus"}
          </Button>
        </div>
      )}
      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}
