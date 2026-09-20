"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CartDraft, CartItem, ChannelType, TableLabel } from "./types";
import { emptyCartDraft, upsertCartLine } from "./types";

const DEFAULT_STORAGE_KEY = "pos-mi-ayam:cart-draft";

// A tablet can lose power or restart mid-order — the draft cart must survive
// that, not just live in a React state variable. localStorage is plenty for
// a single in-progress cart (a handful of line items); no IndexedDB needed.
function loadDraft(storageKey: string): CartDraft {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return emptyCartDraft();
    const parsed = JSON.parse(raw) as CartDraft;
    if (!Array.isArray(parsed.items)) return emptyCartDraft();
    return {
      ...parsed,
      customerName: parsed.customerName ?? "",
      // A draft written by an older build has no categorySortOrder. Default
      // it rather than letting `undefined` through: NaN in the comparator
      // would scramble the whole cart, and a draft outlives a deploy.
      items: parsed.items.map((item) => ({ ...item, categorySortOrder: item.categorySortOrder ?? 0 })),
    };
  } catch {
    return emptyCartDraft();
  }
}

function saveDraft(storageKey: string, draft: CartDraft) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // Private browsing / storage disabled — draft just won't survive a
    // restart in that case, but the session keeps working.
  }
}

// Separate storage key per call site (e.g. the pre-order builder) so an
// in-progress walk-in cart and an in-progress pre-order cart on the same
// device never clobber each other — see PreOrderScreen.
export function useCartDraft(storageKey: string = DEFAULT_STORAGE_KEY) {
  const [draft, setDraft] = useState<CartDraft>(emptyCartDraft());
  const hydrated = useRef(false);

  useEffect(() => {
    // Intentional one-time hydration from localStorage, not a data sync.
    // It has to run in an effect (localStorage isn't available during SSR),
    // and starting from an empty draft on the server + this swap on mount is
    // what keeps hydration from mismatching, so this doesn't fit the
    // "don't setState in an effect" heuristic the rule is built for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(loadDraft(storageKey));
    hydrated.current = true;
    // storageKey is a static choice per call site, not reactive state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated.current) return; // don't overwrite storage with the initial empty state
    saveDraft(storageKey, draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const setChannel = useCallback((channel: ChannelType) => {
    setDraft((d) => ({ ...d, channel, tableLabel: channel === "DINE_IN" ? d.tableLabel : null }));
  }, []);

  const setTableLabel = useCallback((tableLabel: TableLabel) => {
    setDraft((d) => ({ ...d, tableLabel }));
  }, []);

  const setCustomerName = useCallback((customerName: string) => {
    setDraft((d) => ({ ...d, customerName }));
  }, []);

  // The ONE way a line enters the cart, for a plain tap, a combo shortcut, a
  // confirmed add-on sheet, and an edit alike: upsertCartLine decides whether
  // it merges with a line already there. Pass the edited line's localId and
  // that line is taken out of the running first, so an edit that makes two
  // lines identical merges them. Returns the localId the qty landed on.
  const upsertItem = useCallback(
    (item: Omit<CartItem, "localId">, replacingLocalId: string | null = null) => {
      const result = upsertCartLine(draft.items, item, replacingLocalId);
      setDraft((d) => ({ ...d, items: result.items }));
      return result.localId;
    },
    [draft.items],
  );

  const removeItem = useCallback((localId: string) => {
    setDraft((d) => ({ ...d, items: d.items.filter((i) => i.localId !== localId) }));
  }, []);

  const clear = useCallback(() => {
    setDraft(emptyCartDraft());
  }, []);

  return { draft, setChannel, setTableLabel, setCustomerName, upsertItem, removeItem, clear };
}
