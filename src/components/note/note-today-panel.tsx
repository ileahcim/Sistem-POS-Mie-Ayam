"use client";

import { useEffect, useState } from "react";
import type { TodayActivityRow } from "@/lib/note/today-activity";
import { noteCustomerHref, type NoteBook } from "@/lib/note/books";
import { Card } from "@/components/ui/card";
import { TodayActivityList } from "./today-activity-list";

// How long the row just saved stays tinted — long enough to find it with
// your eyes after the page changes, short enough not to linger.
const HIGHLIGHT_MS = 2500;

// Search + today's list on the Hari Ini tab. After a save the form lands
// here with `?baru=<entry id>`: that row (newest, so always on top) gets a
// brief tint. The param is dropped from the address bar right away, so a
// reload or a later visit doesn't flash it again.
export function NoteTodayPanel({
  book,
  rows,
  highlightId,
}: {
  book: NoteBook;
  rows: TodayActivityRow[];
  highlightId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(highlightId);

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
      <Card>
        <TodayActivityList
          rows={rows}
          customerHref={(id) => `${noteCustomerHref(book, id)}?dari=hari-ini`}
          query={query}
          highlightId={highlight}
        />
      </Card>
    </div>
  );
}
