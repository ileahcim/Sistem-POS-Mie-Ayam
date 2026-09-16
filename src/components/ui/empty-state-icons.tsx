// Small line icons for EmptyState — one per list screen (see CLAUDE.md
// "Kepadatan layar" / D section). currentColor so they inherit whatever
// text color the caller wraps them in.
const shared = {
  width: 40,
  height: 40,
  viewBox: "0 0 40 40",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function NoOrdersIcon() {
  return (
    <svg {...shared}>
      <path d="M11 6h18v28l-4.5-3-4.5 3-4.5-3-4.5 3V6Z" />
      <path d="M15 14h10M15 19h10M15 24h6" />
    </svg>
  );
}

export function NoDebtIcon() {
  return (
    <svg {...shared}>
      <rect x="5" y="11" width="30" height="21" rx="3" />
      <path d="M5 17h30" />
      <circle cx="27" cy="24.5" r="3.5" />
    </svg>
  );
}

export function NoScheduleIcon() {
  return (
    <svg {...shared}>
      <rect x="6" y="8" width="28" height="26" rx="3" />
      <path d="M6 16h28M13 5v6M27 5v6" />
      <path d="M20 22v5l3.5 2" />
    </svg>
  );
}

export function NoExpenseIcon() {
  return (
    <svg {...shared}>
      <circle cx="16" cy="16" r="10" />
      <circle cx="24" cy="24" r="10" />
      <path d="M16 12v8M12 16h8" />
    </svg>
  );
}

export function NoHistoryIcon() {
  return (
    <svg {...shared}>
      <circle cx="20" cy="21" r="14" />
      <path d="M20 13v8l6 4" />
      <path d="M9 8 6 11M31 8l3 3" />
    </svg>
  );
}
