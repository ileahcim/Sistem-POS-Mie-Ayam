"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/get-current-user";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Supabase Storage bucket created by migration 20260918090000 (public
// read, OWNER-only write via storage RLS as a second lock behind
// requireRole below).
const BUCKET = "product-images";
const MAX_BYTES = 2 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

// The object path inside our bucket for a public URL we issued, or null
// for anything else (never delete what we didn't upload).
function ownObjectPath(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

// The browser already shrinks the photo (~800×600 WebP) before sending, so
// the request stays far below the server action body limit.
export async function uploadProductImage(formData: FormData): Promise<ActionResult> {
  await requireRole("OWNER");

  const productId = String(formData.get("productId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "File foto tidak terbaca." };
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) return { ok: false, error: "Format foto harus JPG, PNG, atau WebP." };
  if (file.size > MAX_BYTES) return { ok: false, error: "Foto terlalu besar (maks. 2 MB)." };

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { imageUrl: true } });
  if (!product) return { ok: false, error: "Produk tidak ditemukan." };

  const supabase = await createClient();
  // A new file name every time: the public URL changes with each upload, so
  // tablets never keep showing a cached old photo.
  const path = `${productId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) return { ok: false, error: `Gagal mengunggah: ${error.message}` };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  await prisma.product.update({ where: { id: productId }, data: { imageUrl: data.publicUrl } });

  const oldPath = ownObjectPath(product.imageUrl);
  if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]); // best effort — the DB already points at the new photo

  return { ok: true };
}

// Back to the name-based placeholder.
export async function removeProductImage(productId: string): Promise<ActionResult> {
  await requireRole("OWNER");

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { imageUrl: true } });
  if (!product) return { ok: false, error: "Produk tidak ditemukan." };

  await prisma.product.update({ where: { id: productId }, data: { imageUrl: null } });

  const oldPath = ownObjectPath(product.imageUrl);
  if (oldPath) {
    const supabase = await createClient();
    await supabase.storage.from(BUCKET).remove([oldPath]);
  }
  return { ok: true };
}
