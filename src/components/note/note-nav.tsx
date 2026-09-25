import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { noteSectionHref, type NoteBook, type NoteSection } from "@/lib/note/books";

const SECTIONS: { section: NoteSection; label: string }[] = [
  { section: "hari-ini", label: "Hari Ini" },
  { section: "utang", label: "Utang" },
  { section: "ringkasan", label: "Ringkasan" },
];

// Top of every Note tab. First the book switcher — Mi Mentah (raw noodles
// from production) vs Frozen (consigned to a reseller): two fully separate
// ledgers, each with its own customers, balances, Ringkasan and export
// (CLAUDE.md "Buku Frozen"). Switching keeps the tab you're on. Then the
// book's three tabs as plain links (each tab is its own route, so the
// browser's back button and a reload behave). The two rows look different
// on purpose — green pills pick the book, the underline picks the tab — so
// they never read as one six-way choice.
export function NoteNav({ book, section }: { book: NoteBook; section: NoteSection }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-pill bg-muted flex h-12 w-fit items-center p-1" role="group" aria-label="Pilih buku">
        {(["mie", "frozen"] as const).map((b) => (
          <Link
            key={b}
            href={noteSectionHref(b, section)}
            aria-current={book === b ? "page" : undefined}
            className={cn(
              "rounded-pill flex h-10 items-center px-4 text-sm font-semibold",
              book === b ? "bg-primary text-white" : "text-ink-muted",
            )}
          >
            {b === "mie" ? "Mi Mentah" : "Frozen"}
          </Link>
        ))}
      </div>
      <nav className="border-border grid grid-cols-3 border-b" aria-label="Bagian">
        {SECTIONS.map(({ section: s, label }) => (
          <Link
            key={s}
            href={noteSectionHref(book, s)}
            aria-current={section === s ? "page" : undefined}
            className={cn(
              "-mb-px flex min-h-12 items-center justify-center border-b-[3px] px-2 text-base font-semibold",
              section === s ? "border-primary text-primary-strong" : "text-ink-muted border-transparent",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
