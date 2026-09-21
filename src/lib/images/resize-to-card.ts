// Browser-side: turns whatever the owner picked into the file we store for a
// product photo — 800×600 (4:3, the shape of the product card's photo box),
// WebP (JPEG where the browser can't encode WebP). A 5 MB phone photo becomes
// a ~60-120 KB file before it is ever sent.
export const CARD_PHOTO_WIDTH = 800;
export const CARD_PHOTO_HEIGHT = 600;

// The WHOLE photo is fitted inside the frame and centred on white — it is
// never cropped. (It used to be centre-cropped to fill 4:3, which cut the top
// and bottom off a tall bottle for good: the crop is baked into the stored
// file, so no amount of object-fit on the card can bring it back.) Photos are
// shot on white, so the bars beside a tall product disappear into the canvas.
// The white fill is also what flattens a transparent PNG (JPEG has no alpha,
// and a see-through WebP would show the card colour through the product).
export async function resizeToCard(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(CARD_PHOTO_WIDTH / bitmap.width, CARD_PHOTO_HEIGHT / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  const canvas = document.createElement("canvas");
  canvas.width = CARD_PHOTO_WIDTH;
  canvas.height = CARD_PHOTO_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CARD_PHOTO_WIDTH, CARD_PHOTO_HEIGHT);
  ctx.drawImage(bitmap, (CARD_PHOTO_WIDTH - w) / 2, (CARD_PHOTO_HEIGHT - h) / 2, w, h);
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
