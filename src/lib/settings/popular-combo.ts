// How many times a product+add-on combination must have sold in the last 30
// days to earn a "Menu Populer" shortcut on the Kasir screen. ONE list, read
// by both sides: the settings card renders these buttons and the server
// action accepts only these values — the screen can never offer something the
// server rejects, and no client can store 0 or 1 (which would turn every
// add-on order into a shortcut).
//
// Neutral module, not an export of the "use server" actions file (that file
// may only export async functions — see the client/server note at the bottom
// of CLAUDE.md). Presets rather than a number field, same reason as
// preorder-reminder.ts.
export const POPULAR_COMBO_DEFAULT_MIN_SALES = 10;

export const POPULAR_COMBO_MIN_SALES_CHOICES: number[] = [3, 5, 10, 15, 20, 30];

export function isPopularComboMinSalesChoice(value: number): boolean {
  return POPULAR_COMBO_MIN_SALES_CHOICES.includes(value);
}
