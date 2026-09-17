// Date <input> helpers for the Catatan Mi Mentah forms. These work on the
// DEVICE's wall clock on purpose — same carve-out as preorder-screen.tsx's
// date input (see CLAUDE.md "Zona waktu"): the owner's phone/tablet is
// assumed to be set to WIB. Client-only; server code must use timezone.ts.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A stored ledger date (device-local midnight as an ISO instant) back to
// the "YYYY-MM-DD" value a date input expects.
export function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateInputToIso(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toISOString();
}
