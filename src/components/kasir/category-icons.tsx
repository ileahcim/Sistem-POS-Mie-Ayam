import type { JSX } from "react";

// Small line icons, one per fixed menu category (see CLAUDE.md "Menu &
// harga" for the exact category list/order) — currentColor so they pick up
// the active/inactive tab color automatically.
const shared = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function MakananIcon() {
  return (
    <svg {...shared}>
      <path d="M2 7h12a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5Z" />
      <path d="M4.5 7c0-2.2 1.3-3.8 1-4.8M8 7c0-2.2 0.8-3.6 0.4-4.8M11.5 7c0-1.8-0.9-3.2-0.8-4" />
    </svg>
  );
}

function MinumanIcon() {
  return (
    <svg {...shared}>
      <path d="M4.5 4h7l-0.7 8.2a1 1 0 0 1-1 0.8H6.2a1 1 0 0 1-1-0.8L4.5 4Z" />
      <path d="M3.5 4h9M9.5 4V1.8M9.5 1.8h1.3" />
    </svg>
  );
}

function KulkasIcon() {
  return (
    <svg {...shared}>
      <rect x="4.5" y="1.5" width="7" height="13" rx="1.6" />
      <path d="M4.5 6.2h7" />
      <path d="M6.3 3v1.4M6.3 7.8v1.4" />
    </svg>
  );
}

function LainIcon() {
  return (
    <svg {...shared}>
      <circle cx="4" cy="8" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FrozenIcon() {
  return (
    <svg {...shared}>
      <path d="M8 1.5v13M8 1.5 6.3 3M8 1.5 9.7 3M8 14.5l-1.7-1.5M8 14.5l1.7-1.5" />
      <path d="M2.8 4.75l10.4 6.5M2.8 4.75l0.3 2.3M2.8 4.75l2.2-0.7" />
      <path d="M13.2 4.75 2.8 11.25M13.2 4.75l-2.2-0.7M13.2 4.75l-0.3 2.3" />
    </svg>
  );
}

// Fixed set matching CLAUDE.md's fixed category list. Icons only — the tab
// colors are the same neutral/green for every category (category-tabs.tsx).
export const CATEGORY_META: Record<string, { Icon: () => JSX.Element }> = {
  Makanan: { Icon: MakananIcon },
  "Minuman Racik": { Icon: MinumanIcon },
  Kulkas: { Icon: KulkasIcon },
  "Lain-lain": { Icon: LainIcon },
  Frozen: { Icon: FrozenIcon },
};
