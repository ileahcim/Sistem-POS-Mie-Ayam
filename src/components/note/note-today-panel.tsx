"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import type { TodayActivity } from "@/lib/note/today-activity";
import type { MieLedgerEntryDTO } from "@/lib/mie/types";
import type { FrozenLedgerEntryDTO } from "@/lib/frozen/types";
import { NOTE_BOOK, noteCustomerHref, type NoteBook } from "@/lib/note/books";
import { Card } from "@/components/ui/card";
import { TodayActivityList } from "./today-activity-list";
import { EntrySheet } from "./mie-sheets";
import { FrozenEntrySheet } from "./frozen-sheets";

// How long the row just saved stays tinted — long enough to find it with
// your eyes after the page changes, short enough not to linger.
const HIGHLIGHT_MS = 2500;

export type NoteTodayEntry = MieLedgerEntryDTO | FrozenLedgerEntryDTO;

// Search + today's list on the Hari Ini tab. After a save the form lands
// here with `?baru=<entry id>`: that entry's customer row gets a brief tint.
// The param is dropped from the address bar right away, so a reload or a
// later visit doesn't flash it again.
//
// Edit/Hapus on a transaction open the book's own entry sheet — the very
// same EntrySheet / FrozenEntrySheet the customer page and Ringkasan open,
// so one edit/delete path with one set of rules. Its router.refresh()
// re-reads today's activity, and the rows regroup/recolour on their own.
export function NoteTodayPanel({
  book,
  activity,
  highlightId,
}: {
  book: NoteBook;
  activity: TodayActivity<NoteTodayEntry>;
  highlightId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(highlightId);
  const [editing, setEditing] = useState<{ entry: NoteTodayEntry; action: "edit" | "delete" } | null>(null);

  useEffect(() => {
    if (!highlightId) return;
    window.history.replaceState(window.history.state, "", window.location.pathname);
    const timer = window.setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`${book}-today-search`} className="sr-only">
        Cari nama pelanggan
      </label>
      <input
        id={`${book}-today-search`}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari nama pelanggan"
        className="rounded-input border-border bg-surface h-12 w-full border px-3 text-base"
      />
      <Card className="overflow-hidden">
        <TodayActivityList
          activity={activity}
          unit={book === "mie" ? "kg" : "pcs"}
          customerHref={(id) => `${noteCustomerHref(book, id)}?dari=hari-ini`}
          // No `dari` = opened from Hari Ini: Batal and the save land back here.
          paymentHref={(id) => `${NOTE_BOOK[book].paymentHref}?customerId=${encodeURIComponent(id)}`}
          query={query}
          highlightId={highlight}
          onEdit={(entry) => setEditing({ entry, action: "edit" })}
          onDelete={(entry) => setEditing({ entry, action: "delete" })}
        />
      </Card>

      <AnimatePresence>
        {editing &&
          (book === "mie" ? (
            <EntrySheet
              key={editing.entry.id}
              entry={editing.entry as MieLedgerEntryDTO}
              initialAction={editing.action}
              onClose={() => setEditing(null)}
            />
          ) : (
            <FrozenEntrySheet
              key={editing.entry.id}
              entry={editing.entry as FrozenLedgerEntryDTO}
              initialAction={editing.action}
              onClose={() => setEditing(null)}
            />
          ))}
      </AnimatePresence>
    </div>
  );
}
