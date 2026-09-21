import { formatRupiah } from "@/lib/printing/format";
import { isDepositMethod } from "./settle";

// The one check for a DP about to be recorded — used by both "create pre-order
// with DP" and "+ Catat DP" on an existing one, so the two can never disagree.
// Returns the message to show, or null when the DP is fine.
//
// A DP above the order total is REFUSED here, on the server, rather than
// accepted and sorted out later: at that point the money is already in the
// drawer against an order that can never use it.
export function validateDeposit(input: {
  amount: number;
  method: unknown;
  total: number;
  alreadyHeld: number;
}): string | null {
  if (!Number.isInteger(input.amount) || input.amount <= 0) return "Nominal DP tidak valid.";
  if (!isDepositMethod(input.method)) return "Metode DP harus Cash atau QRIS.";

  const room = input.total - input.alreadyHeld;
  if (room <= 0) return "Pesanan ini sudah tertutup penuh oleh DP sebelumnya — tidak perlu DP lagi.";
  if (input.amount > room) {
    const held = input.alreadyHeld > 0 ? `, DP sebelumnya ${formatRupiah(input.alreadyHeld)}` : "";
    return `DP melebihi total pesanan. Total ${formatRupiah(input.total)}${held} — DP maksimal ${formatRupiah(room)}.`;
  }
  return null;
}
