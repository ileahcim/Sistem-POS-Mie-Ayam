"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FrozenCustomerDetail } from "@/lib/frozen/get-frozen-customer-detail";
import type { FrozenAdjustmentKind } from "@/lib/frozen/types";
import { FROZEN_ADJUSTMENT_LABEL, formatFrozenEntryLabel } from "@/lib/frozen/types";
import { todayDateStr, isoToDateInput, dateInputToIso } from "@/lib/mie/date-input";
import {
  createFrozenAdjustment,
  deleteFrozenEntry,
  updateFrozenCustomer,
  updateFrozenEntry,
} from "@/app/note/frozen-actions";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { cn } from "@/components/ui/cn";

type Entry = FrozenCustomerDetail["entries"][number];

const INPUT = "rounded-input border-border h-12 w-full border px-3 text-base";

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-ink-muted text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit nama & keterangan pelanggan
// ---------------------------------------------------------------------------

export function EditFrozenCustomerSheet({
  customer,
  onClose,
}: {
  customer: Pick<FrozenCustomerDetail, "id" | "name" | "note">;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(customer.name);
  const [note, setNote] = useState(customer.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateFrozenCustomer(customer.id, name, note);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
    onClose();
  }

  return (
    <Sheet
      title="Edit pelanggan"
      onClose={onClose}
      footer={
        <Button variant="primary" size="large" fullWidth disabled={saving || !name.trim()} onClick={handleSave}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Nama" htmlFor="edit-frozen-customer-name">
          <input id="edit-frozen-customer-name" className={INPUT} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Keterangan (opsional)" htmlFor="edit-frozen-customer-note">
          <input id="edit-frozen-customer-note" className={INPUT} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error && <p className="text-danger text-sm">{error}</p>}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Koreksi saldo — adds a NEW ledger row
// ---------------------------------------------------------------------------

const ADJUSTMENT_KINDS: { kind: FrozenAdjustmentKind; hint: string }[] = [
  { kind: "OPENING_BALANCE", hint: "Utang lama yang belum tercatat" },
  { kind: "CORRECTION_ADD", hint: "Menambah utang" },
  { kind: "CORRECTION_SUBTRACT", hint: "Mengurangi utang" },
];

export function FrozenAdjustmentSheet({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<FrozenAdjustmentKind>("OPENING_BALANCE");
  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState(todayDateStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const noteRequired = kind !== "OPENING_BALANCE";
  const canSave = !saving && amount !== "" && Number(amount) > 0 && (!noteRequired || note.trim() !== "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await createFrozenAdjustment({
      customerId,
      kind,
      amount: Number(amount),
      date: dateInputToIso(date),
      note,
    });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
    onClose();
  }

  return (
    <Sheet
      title="Koreksi saldo"
      onClose={onClose}
      footer={
        <Button variant="primary" size="large" fullWidth disabled={!canSave} onClick={handleSave}>
          {saving ? "Menyimpan..." : "Tambah baris"}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-ink-muted text-sm font-medium">Jenis</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {ADJUSTMENT_KINDS.map((k) => (
              <button
                key={k.kind}
                type="button"
                onClick={() => setKind(k.kind)}
                className={cn(
                  "rounded-card flex min-h-14 flex-col items-start justify-center border px-3 py-2 text-left",
                  kind === k.kind ? "border-primary bg-primary-soft" : "border-border",
                )}
              >
                <span className="text-ink text-sm font-bold">{FROZEN_ADJUSTMENT_LABEL[k.kind]}</span>
                <span className="text-ink-muted text-xs">{k.hint}</span>
              </button>
            ))}
          </div>
        </div>
        <Field label="Nominal" htmlFor="frozen-adjust-amount">
          <RupiahInput id="frozen-adjust-amount" value={amount} onChange={setAmount} placeholder="0" className="h-12 text-base" />
        </Field>
        <Field label="Tanggal" htmlFor="frozen-adjust-date">
          <input id="frozen-adjust-date" type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={noteRequired ? "Keterangan (wajib)" : "Keterangan (opsional)"} htmlFor="frozen-adjust-note">
          <input
            id="frozen-adjust-note"
            className={INPUT}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={noteRequired ? "mis. salah catat nota 3 Sep" : "mis. utang dari buku lama"}
          />
        </Field>
        <p className="text-ink-faint text-xs">Baris lama tidak diubah — koreksi dicatat sebagai baris baru.</p>
        {error && <p className="text-danger text-sm">{error}</p>}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Edit / hapus satu baris riwayat
// ---------------------------------------------------------------------------

export function FrozenEntrySheet({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const router = useRouter();
  const isOrder = entry.kind === "ORDER";
  const isCorrection = entry.kind === "CORRECTION_ADD" || entry.kind === "CORRECTION_SUBTRACT";
  const [pcs, setPcs] = useState(entry.pcs != null ? String(entry.pcs) : "");
  const [pricePerPcs, setPricePerPcs] = useState<number | "">(entry.pricePerPcs ?? "");
  const [amount, setAmount] = useState<number | "">(entry.amount);
  const [date, setDate] = useState(isoToDateInput(entry.date));
  const [note, setNote] = useState(entry.note ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcsNumber = Number(pcs);
  const pcsValid = pcs.trim() !== "" && Number.isInteger(pcsNumber) && pcsNumber > 0;
  const canSave = isOrder
    ? pcsValid && pricePerPcs !== "" && Number(pricePerPcs) > 0
    : amount !== "" && Number(amount) > 0 && (!isCorrection || note.trim() !== "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateFrozenEntry(entry.id, {
      ...(isOrder ? { pcs: pcsNumber, pricePerPcs: Number(pricePerPcs) } : { amount: Number(amount) }),
      date: dateInputToIso(date),
      note,
    });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
    onClose();
  }

  async function handleDelete() {
    setSaving(true);
    setError(null);
    const result = await deleteFrozenEntry(entry.id);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
    onClose();
  }

  return (
    <Sheet
      title={`Edit ${formatFrozenEntryLabel(entry)}`}
      onClose={onClose}
      footer={
        confirmDelete ? (
          <div className="flex flex-col gap-2">
            <p className="text-danger text-center text-sm font-semibold">
              Hapus baris ini? Saldo baris-baris sesudahnya ikut berubah.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="large" fullWidth onClick={() => setConfirmDelete(false)}>
                Tidak jadi
              </Button>
              <Button variant="danger" size="large" fullWidth disabled={saving} onClick={handleDelete}>
                {saving ? "Menghapus..." : "Ya, Hapus"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="danger" size="large" onClick={() => setConfirmDelete(true)}>
              Hapus
            </Button>
            <Button variant="primary" size="large" fullWidth disabled={saving || !canSave} onClick={handleSave}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-3">
        {isOrder ? (
          <>
            <div className="flex gap-3">
              <div className="flex-1">
                <Field label="Jumlah (pcs)" htmlFor="frozen-entry-pcs">
                  <input
                    id="frozen-entry-pcs"
                    type="text"
                    inputMode="numeric"
                    className={INPUT}
                    value={pcs}
                    onChange={(e) => setPcs(e.target.value.replace(/[^\d]/g, ""))}
                  />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="Harga/pcs" htmlFor="frozen-entry-price">
                  <RupiahInput id="frozen-entry-price" value={pricePerPcs} onChange={setPricePerPcs} className="h-12 text-base" />
                </Field>
              </div>
            </div>
            {pcsValid && pricePerPcs !== "" && (
              <p className="text-ink-muted text-sm">
                Total: Rp{Math.round(pcsNumber * Number(pricePerPcs)).toLocaleString("id-ID")}
              </p>
            )}
          </>
        ) : (
          <Field label="Nominal" htmlFor="frozen-entry-amount">
            <RupiahInput id="frozen-entry-amount" value={amount} onChange={setAmount} className="h-12 text-base" />
          </Field>
        )}
        <Field label="Tanggal" htmlFor="frozen-entry-date">
          <input id="frozen-entry-date" type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={isCorrection ? "Keterangan (wajib)" : "Catatan (opsional)"} htmlFor="frozen-entry-note">
          <input id="frozen-entry-note" className={INPUT} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <p className="text-ink-faint text-xs">Dicatat oleh {entry.createdByName}</p>
        {error && <p className="text-danger text-sm">{error}</p>}
      </div>
    </Sheet>
  );
}
