import type { TodayActivityRow } from "@/lib/note/today-activity";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { NOTE_BOOK, type NoteBook } from "@/lib/note/books";
import { LinkButton } from "@/components/ui/link-button";
import { AppHeader } from "@/components/ui/app-header";
import { NoteNav } from "./note-nav";
import { NoteTodayPanel } from "./note-today-panel";

// Hari Ini — the tab Note opens on, built for RECORDING (the most frequent
// job, done standing up): two big buttons, then everything recorded today,
// newest first. Customer management, prices and export live on the Utang
// tab so this one stays clean.
export function NoteTodayScreen({
  book,
  rows,
  highlightId,
  nav,
}: {
  book: NoteBook;
  rows: TodayActivityRow[];
  highlightId: string | null;
  nav: HeaderNav;
}) {
  const cfg = NOTE_BOOK[book];
  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader nav={nav} title={cfg.title} />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <NoteNav book={book} section="hari-ini" />

          <div className="grid grid-cols-2 gap-3">
            <LinkButton href={cfg.orderHref} variant="primary" size="large" fullWidth>
              {cfg.orderLabel}
            </LinkButton>
            <LinkButton href={cfg.paymentHref} variant="secondary" size="large" fullWidth className="border-border border">
              + Pembayaran
            </LinkButton>
          </div>

          <NoteTodayPanel book={book} rows={rows} highlightId={highlightId} />
        </div>
      </div>
    </div>
  );
}
