// Shared header (logo + store identity) and label/value row, used by both
// ReceiptView and PackingListView so the two printouts always read as the
// same "brand" of paper — see CLAUDE.md "Struk & printer". Store name,
// address, and phone always come from Setting (never hardcoded) so an
// owner edit at /admin/settings reaches every printout without a code
// change — see get-settings.ts.

// The monochrome logo (public/assets/logo-ctr-mono.png) was generated once
// from reference/logo HD.png — original is red/yellow/black, which a plain
// grayscale conversion would turn into indistinguishable mid-gray blotches
// on a 1-bit thermal printer. Regenerate it with
// $CLAUDE_JOB_DIR/tmp/make_mono_logo.py (hue-classified, not grayscale) if
// the source artwork ever changes.
export function ReceiptHeader({
  storeName,
  address,
  phone,
}: {
  storeName: string;
  address?: string | null;
  phone?: string | null;
}) {
  const addressLines = address ? address.split("\n") : [];

  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed local asset, not a Next/Image-optimized remote image */}
      <img src="/assets/logo-ctr-mono.png" alt={storeName} className="mb-1 w-[120px]" />
      <div className="text-sm leading-tight font-bold">{storeName}</div>
      {addressLines.map((line, i) => (
        <div key={i} className="text-[11px] leading-tight">
          {line}
        </div>
      ))}
      {phone && <div className="text-[11px] leading-tight">{phone}</div>}
    </div>
  );
}

// "No. Order   : 67" — label column fixed-width (monospace `ch` unit) so
// the colons line up down the block regardless of label length, instead of
// hand-padding each string with spaces.
export function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="inline-block w-[10ch] shrink-0">{label}</span>
      <span>: {value}</span>
    </div>
  );
}
