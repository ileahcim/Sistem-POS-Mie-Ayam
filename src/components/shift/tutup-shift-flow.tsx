"use client";

import { useState } from "react";
import type { UnpaidOrderForClose, ShiftExpense } from "@/lib/shift/get-shift-state";
import { formatRupiah } from "@/lib/printing/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { PriceText } from "@/components/ui/price-text";
import { cn } from "@/components/ui/cn";
import { voidUnpaidOrder, markOrderReceivable, addExpense, closeShift, type CloseShiftResult } from "@/app/shift/actions";

type Step = "unpaid" | "expenses" | "count" | "result";

const CHANNEL_LABEL: Record<UnpaidOrderForClose["channel"], string> = {
  DINE_IN: "Dine In",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

function UnpaidOrderRow({
  order,
  canVoid,
  onResolved,
}: {
  order: UnpaidOrderForClose;
  canVoid: boolean;
  onResolved: (orderId: string) => void;
}) {
  const [mode, setMode] = useState<"idle" | "void" | "receivable">("idle");
  const [text, setText] = useState(order.customerName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmVoid() {
    setSaving(true);
    setError(null);
    const result = await voidUnpaidOrder(order.id, text);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    onResolved(order.id);
  }

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
          #{order.queueNumber} · {order.channel === "DINE_IN" ? order.tableLabel : CHANNEL_LABEL[order.channel]}
        </span>
        <PriceText amount={order.total} weight="primary" />
      </div>

      {mode === "idle" && (
        <div className="mt-3 flex gap-2">
          {canVoid && (
            <Button variant="danger" fullWidth onClick={() => setMode("void")}>
              Batalkan
            </Button>
          )}
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

      {mode === "void" && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Alasan pembatalan"
            className="rounded-input border-border h-11 border px-3 text-sm"
          />
          {error && <p className="text-danger text-sm">{error}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setMode("idle")}>
              Batal
            </Button>
            <Button variant="danger" fullWidth disabled={saving || !text.trim()} onClick={confirmVoid}>
              {saving ? "Memproses..." : "Konfirmasi Batalkan"}
            </Button>
          </div>
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
  userRole,
}: {
  initialUnpaidOrders: UnpaidOrderForClose[];
  initialExpenses: ShiftExpense[];
  userRole: "OWNER" | "CASHIER";
}) {
  const [unpaidOrders, setUnpaidOrders] = useState(initialUnpaidOrders);
  const [step, setStep] = useState<Step>(initialUnpaidOrders.length > 0 ? "unpaid" : "expenses");

  const [expenses, setExpenses] = useState(initialExpenses);
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [addingExpense, setAddingExpense] = useState(false);

  const [countedCash, setCountedCash] = useState("");
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
    setExpenses((list) => [...list, { id: crypto.randomUUID(), description: expenseDesc.trim(), amount: Number(expenseAmount) }]);
    setExpenseDesc("");
    setExpenseAmount("");
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
    <div className="bg-canvas flex h-dvh flex-col overflow-y-auto p-4">
      <h1 className="mb-4 text-xl font-bold text-ink">Tutup Shift</h1>

      {step === "unpaid" && (
        <div className="flex flex-col gap-3">
          <p className="text-ink-muted text-sm">
            Ada {unpaidOrders.length} order belum selesai. Selesaikan semua dulu sebelum lanjut.
          </p>
          {unpaidOrders.map((order) => (
            <UnpaidOrderRow
              key={order.id}
              order={order}
              canVoid={userRole === "OWNER"}
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
                <div key={e.id} className="flex justify-between p-4 text-sm">
                  <span className="text-ink">{e.description}</span>
                  <PriceText amount={e.amount} weight="secondary" />
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
            <input
              type="number"
              inputMode="numeric"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              placeholder="Nominal"
              className="rounded-input border-border h-11 border px-3 text-sm"
            />
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
          <input
            type="number"
            inputMode="numeric"
            value={countedCash}
            onChange={(e) => setCountedCash(e.target.value)}
            placeholder="Total uang fisik di laci"
            className="rounded-input border-border h-14 border px-4 text-lg"
          />
          {closeError && <p className="text-danger text-sm">{closeError}</p>}
          <Button variant="primary" size="large" fullWidth disabled={closing || !countedCash} onClick={handleClose}>
            {closing ? "Menutup..." : "Tutup Shift"}
          </Button>
        </div>
      )}

      {step === "result" && result && (
        <div className="flex flex-col gap-3">
          <Card padded className="flex flex-col gap-1">
            <div className="flex justify-between py-1 text-sm text-ink-muted">
              <span>Penjualan Cash</span>
              <PriceText amount={result.cashSales} weight="secondary" />
            </div>
            <div className="flex justify-between py-1 text-sm text-ink-muted">
              <span>Penjualan Non-Cash</span>
              <PriceText amount={result.nonCashSales} weight="secondary" />
            </div>
            <div className="flex justify-between py-1 text-sm text-ink-muted">
              <span>Total Pengeluaran</span>
              <PriceText amount={result.expenseTotal} weight="secondary" />
            </div>
            <div className="flex justify-between py-1 text-sm font-semibold text-ink">
              <span>Uang Seharusnya</span>
              <PriceText amount={result.expectedCash} weight="primary" />
            </div>
            <div className="flex justify-between py-1 text-sm text-ink-muted">
              <span>Uang Fisik Dihitung</span>
              <PriceText amount={result.countedCash} weight="secondary" />
            </div>
            <div
              className={cn(
                "border-border mt-2 flex justify-between border-t pt-2 text-base font-bold",
                result.difference === 0 ? "text-ink" : result.difference > 0 ? "text-primary-strong" : "text-danger",
              )}
            >
              <span>Selisih</span>
              <span>
                {result.difference > 0 ? "+" : ""}
                {formatRupiah(result.difference)}
              </span>
            </div>
          </Card>
          <LinkButton href="/kasir" variant="primary" size="large" fullWidth>
            Selesai
          </LinkButton>
        </div>
      )}
    </div>
  );
}
