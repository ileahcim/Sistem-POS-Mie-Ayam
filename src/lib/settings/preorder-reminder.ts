// How early the Kasir screen starts warning about a pre-order coming due.
// ONE list, read by both sides: the settings card renders these buttons and
// the server action accepts only these values, so the screen can never
// offer something the server rejects and no client can store 0 (bar never
// appears) or a week (bar never goes away).
//
// Deliberately a neutral module, not an export from the "use server" actions
// file: a "use server" file may only export async functions, and exporting a
// constant from one fails at RUNTIME while `next build` still succeeds — see
// the client/server note at the bottom of CLAUDE.md.
//
// Presets rather than a number field because the register is used standing
// up by staff who shouldn't have to meet a numeric keyboard (CLAUDE.md
// "Konteks pengguna"). Minutes, so "30 menit" needs no fractions.
export const PREORDER_REMINDER_CHOICES: { minutes: number; label: string }[] = [
  { minutes: 30, label: "30 menit" },
  { minutes: 60, label: "1 jam" },
  { minutes: 120, label: "2 jam" },
  { minutes: 180, label: "3 jam" },
  { minutes: 360, label: "6 jam" },
];

export function isPreorderReminderChoice(minutes: number): boolean {
  return PREORDER_REMINDER_CHOICES.some((choice) => choice.minutes === minutes);
}
