import type { ReactNode } from "react";
import { formatRupiah } from "@/lib/printing/format";
import { PriceText } from "@/components/ui/price-text";
import { cn } from "@/components/ui/cn";

// The frozen figures of one closed shift — exactly the Shift columns
// closeShift writes. Both the Tutup Shift result and the Dashboard shift
// detail render them through ShiftSummary, so the owner reads one layout.
export type ShiftFigures = {
  openingCash: number;
  cashSales: number;
  nonCashSales: number;
  expenseTotal: number;
  expectedCash: number;
  countedCash: number;
  difference: number;
  depositsAppliedCash: number;
  depositsReceivedCash: number;
  depositsReceivedNonCash: number;
  depositRefundsCash: number;
  depositRefundsNonCash: number;
  forfeitedDeposits: number;
  receivableSettledCash: number;
  receivableSettledNonCash: number;
  receivablePocketCash: number;
};

// Did any pre-order DP move that day? Decides whether the DP rows show at all.
function hasDepositMovement(f: ShiftFigures): boolean {
  return (
    f.depositsAppliedCash > 0 ||
    f.depositsReceivedCash > 0 ||
    f.depositsReceivedNonCash > 0 ||
    f.depositRefundsCash > 0 ||
    f.depositRefundsNonCash > 0 ||
    f.forfeitedDeposits > 0
  );
}

export function differenceClass(value: number): string {
  return value === 0 ? "text-ink" : value > 0 ? "text-primary-strong" : "text-danger";
}

export function formatDifference(value: number): string {
  return `${value > 0 ? "+" : ""}${formatRupiah(value)}`;
}

function Row({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("text-ink-muted flex justify-between gap-3 py-1 text-sm", className)}>
      <span>{label}</span>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-ink mb-1 text-xs font-bold tracking-wide uppercase">{children}</h3>;
}

// Two separate blocks, each with its own heading (owner's request, 21 Sep 2026):
//   1. sales — Cash, QRIS, and their total;
//   2. the drawer — everything that explains "Uang seharusnya", then the count
//      and the difference.
// They are apart on purpose: total sales include QRIS, which never enters the
// drawer. Sitting next to "Uang fisik dihitung", the eye compares the two and
// sees a difference that isn't there.
//
// Blind count still holds: the Tutup Shift flow only renders this AFTER the
// physical count was entered (step "result"), never before.
export function ShiftSummary({ figures: f, salesTitle }: { figures: ShiftFigures; salesTitle: string }) {
  return (
    <div className="flex flex-col gap-4">
      <section>
        <SectionTitle>{salesTitle}</SectionTitle>
        <Row label="Cash">
          <PriceText amount={f.cashSales} weight="secondary" />
        </Row>
        <Row label="QRIS">
          <PriceText amount={f.nonCashSales} weight="secondary" />
        </Row>
        <Row label="Total penjualan" className="border-border text-ink mt-1 border-t pt-2 font-semibold">
          <PriceText amount={f.cashSales + f.nonCashSales} weight="primary" />
        </Row>
        {f.receivableSettledCash + f.receivableSettledNonCash > 0 && (
          <p className="text-ink-faint text-xs">
            Termasuk pelunasan piutang {formatRupiah(f.receivableSettledCash + f.receivableSettledNonCash)} (dari order
            yang dibuat di shift sebelumnya atau ditandai Belum Bayar).
          </p>
        )}
      </section>

      <section>
        <SectionTitle>Hitungan Laci</SectionTitle>
        <Row label="Modal awal laci">
          <PriceText amount={f.openingCash} weight="secondary" />
        </Row>
        <Row label="Penjualan cash">
          <PriceText amount={f.cashSales} weight="secondary" />
        </Row>
        <Row label="Pengeluaran">
          <span>−{formatRupiah(f.expenseTotal)}</span>
        </Row>
        {/* Pre-order DP. Only on a day that had any, so an ordinary day reads
            exactly as it always did. These rows are what make "Uang
            seharusnya" traceable:
              Modal + Penjualan cash - DP dipakai + Penerimaan DP tunai
              - DP dikembalikan tunai - Pengeluaran. */}
        {hasDepositMovement(f) && (
          <div className="bg-canvas rounded-card my-1 flex flex-col gap-0.5 px-3 py-2">
            <p className="text-ink text-xs font-bold">Uang muka (DP)</p>
            <div className="text-ink-muted flex justify-between gap-3 text-sm">
              <span>DP dipakai (sudah diterima sebelumnya)</span>
              <span>−{formatRupiah(f.depositsAppliedCash)}</span>
            </div>
            <div className="text-ink-muted flex justify-between gap-3 text-sm">
              <span>Penerimaan DP (tunai)</span>
              <span>+{formatRupiah(f.depositsReceivedCash)}</span>
            </div>
            <div className="text-ink-muted flex justify-between gap-3 text-sm">
              <span>DP dikembalikan (tunai)</span>
              <span>−{formatRupiah(f.depositRefundsCash)}</span>
            </div>
            {(f.depositsReceivedNonCash > 0 || f.depositRefundsNonCash > 0 || f.forfeitedDeposits > 0) && (
              <div className="border-border mt-1 flex flex-col gap-0.5 border-t pt-1">
                <p className="text-ink-faint text-xs">Tidak memengaruhi uang di laci:</p>
                {f.depositsReceivedNonCash > 0 && (
                  <div className="text-ink-faint flex justify-between gap-3 text-xs">
                    <span>Penerimaan DP QRIS</span>
                    <span>{formatRupiah(f.depositsReceivedNonCash)}</span>
                  </div>
                )}
                {f.depositRefundsNonCash > 0 && (
                  <div className="text-ink-faint flex justify-between gap-3 text-xs">
                    <span>DP dikembalikan (QRIS)</span>
                    <span>{formatRupiah(f.depositRefundsNonCash)}</span>
                  </div>
                )}
                {f.forfeitedDeposits > 0 && (
                  <div className="text-ink-faint flex justify-between gap-3 text-xs">
                    <span>DP hangus (pendapatan, bukan penjualan makanan)</span>
                    <span>{formatRupiah(f.forfeitedDeposits)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {/* Piutang settled this shift: its cash is inside "Penjualan cash"
            above; only what the owner pocketed never reached the drawer.
            Shown only on a day that had a settlement. */}
        {f.receivableSettledCash + f.receivableSettledNonCash > 0 && (
          <div className="bg-canvas rounded-card my-1 flex flex-col gap-0.5 px-3 py-2">
            <p className="text-ink text-xs font-bold">Pelunasan piutang</p>
            <div className="text-ink-faint flex justify-between gap-3 text-xs">
              <span>Tunai (sudah termasuk penjualan cash)</span>
              <span>{formatRupiah(f.receivableSettledCash)}</span>
            </div>
            <div className="text-ink-muted flex justify-between gap-3 text-sm">
              <span>Masuk kantong (tidak di laci)</span>
              <span>−{formatRupiah(f.receivablePocketCash)}</span>
            </div>
            {f.receivableSettledNonCash > 0 && (
              <div className="text-ink-faint flex justify-between gap-3 text-xs">
                <span>QRIS (tidak memengaruhi laci)</span>
                <span>{formatRupiah(f.receivableSettledNonCash)}</span>
              </div>
            )}
          </div>
        )}
        <Row label="Uang seharusnya" className="border-border text-ink mt-1 border-t pt-2 font-semibold">
          <PriceText amount={f.expectedCash} weight="primary" />
        </Row>
        <Row label="Uang fisik dihitung">
          <PriceText amount={f.countedCash} weight="secondary" />
        </Row>
        <div
          className={cn(
            "border-border mt-1 flex justify-between border-t pt-2 text-base font-bold",
            differenceClass(f.difference),
          )}
        >
          <span>Selisih</span>
          <span>{formatDifference(f.difference)}</span>
        </div>
      </section>
    </div>
  );
}
