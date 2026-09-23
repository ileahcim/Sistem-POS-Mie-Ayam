import Link from "next/link";
import { cn } from "@/components/ui/cn";

// Two-pill switcher between Note's two fully separate books — Mi Mentah
// (raw noodles from production) and Frozen (consigned to a reseller,
// settled directly with the owner in cash). Each book keeps its own
// customer list, ledger, Ringkasan and export — this is just navigation
// between two otherwise-independent screens, not a shared tab state
// (CLAUDE.md-worthy brief, "Buku Frozen Terpisah", 22 Sep 2026).
export function NoteBookTabs({ active }: { active: "mie" | "frozen" }) {
  return (
    <div className="rounded-pill bg-muted flex h-12 w-fit items-center p-1" role="group" aria-label="Pilih buku">
      <Link
        href="/note"
        aria-current={active === "mie" ? "page" : undefined}
        className={cn(
          "rounded-pill flex h-10 items-center px-4 text-sm font-semibold",
          active === "mie" ? "bg-primary text-white" : "text-ink-muted",
        )}
      >
        Mi Mentah
      </Link>
      <Link
        href="/note/frozen"
        aria-current={active === "frozen" ? "page" : undefined}
        className={cn(
          "rounded-pill flex h-10 items-center px-4 text-sm font-semibold",
          active === "frozen" ? "bg-primary text-white" : "text-ink-muted",
        )}
      >
        Frozen
      </Link>
    </div>
  );
}
