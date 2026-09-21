import { cn } from "./cn";

// Stable 32-bit string hash (FNV-1a) — same name, same color, every render
// and every device.
function hashName(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// "Mie Ayam" -> "MA", "Bakso Urat (bijian)" -> "BU", "Ceker" -> "CE".
export function productInitials(name: string): string {
  const words = name
    .replace(/\(.*?\)/g, " ")
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Soft tint derived from the name — a placeholder until the owner uploads
// a real photo (these colors are data-derived on purpose, not design
// tokens: each product needs its own recognisable block).
export function productPlaceholderColors(name: string): { background: string; color: string } {
  const hue = hashName(name) % 360;
  return { background: `hsl(${hue} 45% 91%)`, color: `hsl(${hue} 35% 30%)` };
}

// The product picture box: the uploaded photo when there is one, otherwise
// the name-derived placeholder with the product's initials. The box itself
// has a fixed aspect ratio, so the grid never jumps while a photo loads.
//
// A photo is shown WHOLE (object-contain) on a white canvas inside a thin
// frame: photos are shot on white, so the bars left over beside a tall bottle
// vanish into the canvas, and the frame keeps the box visible on a white card.
// The frame is on this element, so it takes the corner radius the caller
// passes in `className`. The placeholder is unframed — its own tint marks it.
export function ProductImage({
  name,
  imageUrl,
  className,
  initialsClassName = "text-3xl",
}: {
  name: string;
  imageUrl: string | null;
  className?: string;
  initialsClassName?: string;
}) {
  if (imageUrl) {
    return (
      <div className={cn("bg-photo-canvas border-photo-frame overflow-hidden border", className)}>
        {/* Plain <img>: photos are already resized to ~800px on upload and
            served from Supabase Storage, so no Next image optimizer needed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
      </div>
    );
  }
  return (
    <div
      aria-hidden
      className={cn("flex items-center justify-center font-bold tracking-wide select-none", className)}
      style={productPlaceholderColors(name)}
    >
      <span className={initialsClassName}>{productInitials(name)}</span>
    </div>
  );
}
