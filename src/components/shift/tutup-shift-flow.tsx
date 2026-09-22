"use client";

import { useState } from "react";
import type { UnpaidOrderForClose, ShiftExpense } from "@/lib/shift/get-shift-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { PriceText } from "@/components/ui/price-text";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { formatQueueLabel } from "@/lib/orders/queue-label";
import { markOrderReceivable, addExpense, deleteExpense, closeShift, type CloseShiftResult } from "@/app/shift/actions";
import { CancelOrderButton } from "@/components/order-aktif/cancel-order-sheet";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { AppHeader } from "@/components/ui/app-header";
import { ShiftSummary } from "./shift-summary";

type Step = "warning" | "unpaid" | "expenses" | "count" | "result";

const CHANNEL_LABEL: Record<UnpaidOrderForClose["channel"], string> = {
  DINE_IN: "Dine In",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

// "Batalkan" here is the exact same Batalkan Order path as Order Aktif
// (CancelOrderButton -> cancelOrder): any cashier, reason required, status
// CANCELLED. VOID is reserved for already-PAID orders (OWNER only).
function UnpaidOrderRow({
  order,
  onResolved,
}: {
  order: UnpaidOrderForClose;
  onResolved: (orderId: string) => void;
}) {
  const [mode, setMode] = useState<"idle" | "receivable">("idle");
  const [text, setText] = useState(order.customerName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmReceivable() {
    setSaving(true);
    setError(null);
    const result = await markOrderReceivable(order.id, text);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    onResolved(order.id);
  }

  return (
    <Card padded>
      <div className="flex justify-between gap-3">
        <span className="font-semibold text-ink">
          {formatQueueLabel(order.queueNumber, order.queueSuffix)} ·{" "}
          {order.channel === "DINE_IN" ? order.tableLabel : CHANNEL_LABEL[order.channel]}
        </span>
        <PriceText amount={order.total} weight="primary" />
      </div>

      {mode === "idle" && (
        <div className="mt-3 flex gap-2">
          <CancelOrderButton
            size="inline"
            orderId={order.id}
            orderLabel={formatQueueLabel(order.queueNumber, order.queueSuffix)}
            onCancelled={() => onResolved(order.id)}
          />
          <Button
            variant="secondary"
            fullWidth
            className="bg-warning-soft text-warning"
            onClick={() => setMode("receivable")}
          >
            Tandai Piutang
          </Button>
        </div>
      )}

      {mode === "receivable" && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nama untuk piutang"
            className="rounded-input border-border h-11 border px-3 text-sm"
          />
          {error && <p className="text-danger text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setMode("idle")}>
              Batal
            </Button>
            <Button
              variant="primary"
              fullWidth
              className="bg-warning"
              disabled={saving || !text.trim()}
              onClick={confirmReceivable}
            >
              {saving ? "Memproses..." : "Konfirmasi Piutang"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function TutupShiftFlow({
  initialUnpaidOrders,
  initialExpenses,
  nav,
}: {
  initialUnpaidOrders: UnpaidOrderForClose[];
  initialExpenses: ShiftExpense[];
  nav: HeaderNav;
}) {
  const [unpaidOrders, setUnpaidOrders] = useState(initialUnpaidOrders);
  const [step, setStep] = useState<Step>(initialUnpaidOrders.length > 0 ? "warning" : "expenses");

  const [expenses, setExpenses] = useState(initialExpenses);
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState<number | "">("");
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [addingExpense, setAddingExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  const [countedCash, setCountedCash] = useState<number | "">("");
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<CloseShiftResult, { ok: true }> | null>(null);

  function handleOrderResolved(orderId: string) {
    setUnpaidOrders((list) => list.filter((o) => o.id !== orderId));
  }

  async function handleAddExpense() {
    setAddingExpense(true);
    setExpenseError(null);
    const result = await addExpense(expenseDesc, Number(expenseAmount));
    setAddingExpense(false);
    if (!result.ok) return setExpenseError(result.error);
    // Real DB id from the server, so Hapus below can act on it right away.
    setExpenses((list) => [...list, { id: result.id, description: expenseDesc.trim(), amount: Number(expenseAmount) }]);
    setExpenseDesc("");
    setExpenseAmount("");
  }

  async function handleDeleteExpense(id: string) {
    setDeletingExpenseId(id);
    setExpenseError(null);
    const result = await deleteExpense(id);
    setDeletingExpenseId(null);
    if (!result.ok) return setExpenseError(result.error);
    setExpenses((list) => list.filter((e) => e.id !== id));
  }

  async function handleClose() {
    setClosing(true);
    setCloseError(null);
    const res = await closeShift(Number(countedCash));
    setClosing(false);
    if (!res.ok) return setCloseError(res.error);
    setResult(res);
    setStep("result");
  }

  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader nav={nav} title="Tutup Shift" />
      <div className="flex-1 overflow-y-auto p-4">

      {step === "warning" && (
        <div className="flex flex-col gap-3">
          <Card padded className="bg-warning-soft flex flex-col gap-1.5">
            <p className="text-warning text-base font-bold">
              Ada {unpaidOrders.length} order belum dibayar
            </p>
            <p className="text-ink-muted text-sm">
              Selesaikan dulu satu per satu — batalkan atau tandai piutang — sebelum lanjut ke
              pengeluaran dan hitung kas.
            </p>
          </Card>
          <Button variant="primary" size="large" fullWidth onClick={() => setStep("unpaid")}>
            Lanjutkan
          </Button>
        </div>
      )}

      {step === "unpaid" && (
        <div className="flex flex-col gap-3">
          <p className="text-ink-muted text-sm">
            Ada {unpaidOrders.length} order belum selesai. Selesaikan semua dulu sebelum lanjut.
          </p>
          {unpaidOrders.map((order) => (
            <UnpaidOrderRow
              key={order.id}
              order={order}
              onResolved={handleOrderResolved}
            />
          ))}
          {unpaidOrders.length === 0 && (
            <Button variant="primary" size="large" fullWidth onClick={() => setStep("expenses")}>
              Lanjut ke Pengeluaran
            </Button>
          )}
        </div>
      )}

      {step === "expenses" && (
        <div className="flex flex-col gap-3">
          <p className="text-ink-muted text-sm">
            Catat dulu semua pengeluaran shift ini (beli gas, bensin, dll) sebelum hitung uang fisik.
          </p>
          <Card>
            {expenses.length === 0 && <p className="text-ink-faint p-4 text-sm">Belum ada pengeluaran.</p>}
            <div className="divide-border flex flex-col divide-y">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <span className="text-ink flex-1">{e.description}</span>
                  <PriceText amount={e.amount} weight="secondary" />
                  <Button
                    variant="secondary"
                    disabled={deletingExpenseId === e.id}
                    onClick={() => handleDeleteExpense(e.id)}
                  >
                    {deletingExpenseId === e.id ? "..." : "Hapus"}
                  </Button>
                </div>
              ))}
            </div>
            <div className="border-border bg-canvas flex justify-between rounded-b-card border-t px-4 py-3">
              <span className="font-bold text-ink">Total Pengeluaran</span>
              <PriceText amount={expenseTotal} weight="total" />
            </div>
          </Card>

          <Card padded className="flex flex-col gap-2">
            <input
              type="text"
              value={expenseDesc}
              onChange={(e) => setExpenseDesc(e.target.value)}
              placeholder="Keterangan (mis. Beli gas)"
              className="rounded-input border-border h-11 border px-3 text-sm"
            />
            <RupiahInput value={expenseAmount} onChange={setExpenseAmount} placeholder="Nominal" className="h-11 text-sm" />
            {expenseError && <p className="text-danger text-sm">{expenseError}</p>}
            <Button
              variant="secondary"
              fullWidth
              disabled={addingExpense || !expenseDesc.trim() || !expenseAmount}
              onClick={handleAddExpense}
            >
              + Tambah Pengeluaran
            </Button>
          </Card>

          <Button variant="primary" size="large" fullWidth onClick={() => setStep("count")}>
            Lanjut ke Hitung Kas
          </Button>
        </div>
      )}

      {step === "count" && (
        <div className="flex flex-col gap-3">
          <p className="text-ink-muted text-sm">
            Hitung fisik semua uang di laci, lalu masukkan jumlahnya. Jangan dihitung dulu berapa yang
            &quot;seharusnya&quot; ada — masukkan apa yang benar-benar kamu hitung.
          </p>
          <RupiahInput
            value={countedCash}
            onChange={setCountedCash}
            placeholder="Total uang fisik di laci"
            className="h-14"
          />
          {closeError && <p className="text-danger text-sm">{closeError}</p>}
          <Button variant="primary" size="large" fullWidth disabled={closing || countedCash === ""} onClick={handleClose}>
            {closing ? "Menutup..." : "Tutup Shift"}
          </Button>
        </div>
      )}

      {step === "result" && result && (
        <div className="flex flex-col gap-3">
          <Card padded>
            <ShiftSummary figures={result} salesTitle="Penjualan Hari Ini" />
          </Card>
          <LinkButton href="/kasir" variant="primary" size="large" fullWidth>
            Selesai
          </LinkButton>
        </div>
      )}
      </div>
    </div>
  );
}
