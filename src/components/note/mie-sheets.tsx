"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MieCustomerDetail } from "@/lib/mie/get-mie-customer-detail";
import type { MieProductDefaults } from "@/lib/mie/get-mie-product-defaults";
import type { MieAdjustmentKind, MieLedgerEntryDTO, MieProductType } from "@/lib/mie/types";
import {
  MIE_ADJUSTMENT_LABEL,
  MIE_FIXED_PRODUCT_TYPES,
  MIE_PASAR_LABEL,
  MIE_PRODUCT_LABEL,
  formatMieEntryLabel,
} from "@/lib/mie/types";
import { todayDateStr, isoToDateInput, dateInputToIso } from "@/lib/mie/date-input";
import {
  createMieAdjustment,
  deleteMieEntry,
  setMieCustomerPrices,
  updateMieCustomer,
  updateMieEntry,
} from "@/app/note/actions";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { cn } from "@/components/ui/cn";
import { PaymentMethodPicker } from "./payment-method-picker";

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

export function EditCustomerSheet({
  customer,
  onClose,
}: {
  customer: Pick<MieCustomerDetail, "id" | "name" | "note">;
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
    const result = await updateMieCustomer(customer.id, name, note);
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
        <Field label="Nama" htmlFor="edit-customer-name">
          <input id="edit-customer-name" className={INPUT} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Keterangan (opsional)" htmlFor="edit-customer-note">
          <input id="edit-customer-note" className={INPUT} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error && <p className="text-danger text-sm">{error}</p>}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Harga khusus — this customer's own Rp/kg per jenis (26 Sep 2026)
// ---------------------------------------------------------------------------

// Empty field = no special price for that jenis: the order form then falls
// back to the customer's last price, then harga umum. Saved as a whole set.
// Only new orders are affected — every recorded order keeps its own price.
export function SpecialPriceSheet({
  customer,
  productDefaults,
  onClose,
}: {
  customer: Pick<MieCustomerDetail, "id" | "name" | "specialPrices">;
  productDefaults: MieProductDefaults;
  onClose: () => void;
}) {
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, number | "">>(() =>
    Object.fromEntries(MIE_FIXED_PRODUCT_TYPES.map((t) => [t, customer.specialPrices[t] ?? ""])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await setMieCustomerPrices(
      customer.id,
      MIE_FIXED_PRODUCT_TYPES.map((t) => ({ productType: t, pricePerKg: prices[t] === "" ? null : Number(prices[t]) })),
    );
    setSaving(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
    onClose();
  }

  return (
    <Sheet
      title={`Harga khusus ${customer.name}`}
      onClose={onClose}
      footer={
        <Button variant="primary" size="large" fullWidth disabled={saving} onClick={handleSave}>
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-ink-muted text-sm">
          Dipakai otomatis di Pesanan Baru untuk pelanggan ini. Kosongkan kalau ikut harga biasa. Pesanan yang sudah
          tercatat tidak berubah.
        </p>
        {MIE_FIXED_PRODUCT_TYPES.map((t) => {
          const general = productDefaults[t];
          return (
            <div key={t} className="flex flex-col gap-1">
              <label htmlFor={`special-price-${t}`} className="text-ink-muted text-sm font-medium">
                {MIE_PRODUCT_LABEL[t]} (per kg)
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <RupiahInput
                    id={`special-price-${t}`}
                    value={prices[t]}
                    onChange={(v) => setPrices((prev) => ({ ...prev, [t]: v > 0 ? v : "" }))}
                    placeholder={general != null ? general.toLocaleString("id-ID") : "Harga biasa"}
                    className="h-12 text-base"
                  />
                </div>
                {prices[t] !== "" && (
                  <Button
                    variant="ghost"
                    size="compact"
                    onClick={() => setPrices((prev) => ({ ...prev, [t]: "" }))}
                    aria-label={`Kosongkan harga khusus ${MIE_PRODUCT_LABEL[t]}`}
                  >
                    Kosongkan
                  </Button>
                )}
              </div>
              <span className="text-ink-faint text-xs">
                {general != null ? `Harga umum Rp${general.toLocaleString("id-ID")}/kg` : "Harga umum belum diisi"}
              </span>
            </div>
          );
        })}
        {error && <p className="text-danger text-sm">{error}</p>}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Koreksi saldo — adds a NEW ledger row
// ---------------------------------------------------------------------------

const ADJUSTMENT_KINDS: { kind: MieAdjustmentKind; hint: string }[] = [
  { kind: "OPENING_BALANCE", hint: "Utang lama yang belum tercatat" },
  { kind: "CORRECTION_ADD", hint: "Menambah utang" },
  { kind: "CORRECTION_SUBTRACT", hint: "Mengurangi utang" },
];

export function AdjustmentSheet({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<MieAdjustmentKind>("OPENING_BALANCE");
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
    const result = await createMieAdjustment({
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
                <span className="text-ink text-sm font-bold">{MIE_ADJUSTMENT_LABEL[k.kind]}</span>
                <span className="text-ink-muted text-xs">{k.hint}</span>
              </button>
            ))}
          </div>
        </div>
        <Field label="Nominal" htmlFor="adjust-amount">
          <RupiahInput id="adjust-amount" value={amount} onChange={setAmount} placeholder="0" className="h-12 text-base" />
        </Field>
        <Field label="Tanggal" htmlFor="adjust-date">
          <input id="adjust-date" type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={noteRequired ? "Keterangan (wajib)" : "Keterangan (opsional)"} htmlFor="adjust-note">
          <input
            id="adjust-note"
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

// The jenis buttons of an ORDER row, in the same order as the new-order
// form: the three fixed jenis, "Mi Pasar" (= Mi Keriting on the pasar
// modal), then Custom.
type JenisChoice = MieProductType | "PASAR";

const JENIS_CHOICES: { value: JenisChoice; label: string }[] = [
  ...MIE_FIXED_PRODUCT_TYPES.map((t) => ({ value: t as JenisChoice, label: MIE_PRODUCT_LABEL[t] })),
  { value: "PASAR", label: MIE_PASAR_LABEL },
  { value: "CUSTOM", label: "Custom" },
];

// null for a legacy row still on the retired FROZEN value — no button is lit
// and the jenis is left alone unless the owner picks one.
function initialJenis(entry: MieLedgerEntryDTO): JenisChoice | null {
  if (entry.productType === "MIE_KERITING" && entry.isPasar) return "PASAR";
  if (entry.productType && JENIS_CHOICES.some((c) => c.value === entry.productType)) return entry.productType;
  return null;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

// Takes a plain MieLedgerEntryDTO, not the customer page's row type — the
// customer ledger and Ringkasan's drill-down list both hand it one of these,
// so edit and delete stay a single code path with a single set of rules
// (runningBalance was never read here). `initialAction: "delete"` just opens
// on the confirmation this sheet already had, for the Hapus button that sits
// on a Ringkasan row — not a second delete path.
export function EntrySheet({
  entry,
  onClose,
  initialAction = "edit",
}: {
  entry: MieLedgerEntryDTO;
  onClose: () => void;
  initialAction?: "edit" | "delete";
}) {
  const router = useRouter();
  const isOrder = entry.kind === "ORDER";
  const isCorrection = entry.kind === "CORRECTION_ADD" || entry.kind === "CORRECTION_SUBTRACT";
  const [jenis, setJenis] = useState<JenisChoice | null>(initialJenis(entry));
  const [customLabel, setCustomLabel] = useState(entry.customLabel ?? "");
  const [kg, setKg] = useState(entry.kg != null ? String(entry.kg).replace(".", ",") : "");
  const [pricePerKg, setPricePerKg] = useState<number | "">(entry.pricePerKg ?? "");
  const [amount, setAmount] = useState<number | "">(entry.amount);
  const [date, setDate] = useState(isoToDateInput(entry.date));
  const [note, setNote] = useState(entry.note ?? "");
  // Starts from whatever the row actually has — null for a payment recorded
  // before the column existed, and it may honestly stay null.
  const [paymentMethod, setPaymentMethod] = useState(entry.paymentMethod);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(initialAction === "delete");
  const [error, setError] = useState<string | null>(null);

  const isPayment = entry.kind === "PAYMENT";
  const kgNumber = Number(kg.replace(",", "."));
  const kgValid = kg.trim() !== "" && Number.isFinite(kgNumber) && kgNumber > 0;
  const canSave = isOrder
    ? kgValid && pricePerKg !== "" && Number(pricePerKg) > 0 && (jenis !== "CUSTOM" || customLabel.trim() !== "")
    : amount !== "" && Number(amount) > 0 && (!isCorrection || note.trim() !== "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateMieEntry(entry.id, {
      ...(isOrder
        ? {
            kg: kgNumber,
            pricePerKg: Number(pricePerKg),
            ...(jenis
              ? {
                  jenis: {
                    productType: jenis === "PASAR" ? ("MIE_KERITING" as const) : jenis,
                    isPasar: jenis === "PASAR",
                    customLabel,
                  },
                }
              : {}),
          }
        : { amount: Number(amount) }),
      ...(isPayment ? { paymentMethod } : {}),
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
    const result = await deleteMieEntry(entry.id);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
    onClose();
  }

  return (
    <Sheet
      title={`Edit ${formatMieEntryLabel(entry)}`}
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
            <div className="flex flex-col gap-1">
              <span className="text-ink-muted text-sm font-medium">Jenis mi</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Jenis mi">
                {JENIS_CHOICES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    aria-pressed={jenis === c.value}
                    onClick={() => setJenis(c.value)}
                    className={cn(
                      "rounded-pill h-12 px-4 text-sm font-semibold",
                      jenis === c.value ? "bg-primary text-white" : "bg-muted text-ink-muted",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <span className="text-ink-faint text-xs">
                Mengganti jenis tidak mengubah harga/kg — ubah harganya sendiri kalau perlu.
              </span>
            </div>
            {jenis === "CUSTOM" && (
              <Field label="Nama jenis mi (request khusus)" htmlFor="entry-custom-label">
                <input
                  id="entry-custom-label"
                  className={INPUT}
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                />
              </Field>
            )}
            <div className="flex gap-3">
              <div className="flex-1">
                <Field label="Jumlah (kg)" htmlFor="entry-kg">
                  <input
                    id="entry-kg"
                    type="text"
                    inputMode="decimal"
                    className={INPUT}
                    value={kg}
                    onChange={(e) => setKg(e.target.value.replace(/[^\d.,]/g, ""))}
                  />
                </Field>
              </div>
              <div className="flex-1">
                <Field label="Harga/kg" htmlFor="entry-price">
                  <RupiahInput id="entry-price" value={pricePerKg} onChange={setPricePerKg} className="h-12 text-base" />
                </Field>
              </div>
            </div>
            {kgValid && pricePerKg !== "" && (
              <p className="text-ink-muted text-sm">
                Total: Rp{Math.round(kgNumber * Number(pricePerKg)).toLocaleString("id-ID")}
              </p>
            )}
          </>
        ) : (
          <Field label="Nominal" htmlFor="entry-amount">
            <RupiahInput id="entry-amount" value={amount} onChange={setAmount} className="h-12 text-base" />
          </Field>
        )}
        {isPayment && (
          <PaymentMethodPicker
            value={paymentMethod}
            onChange={setPaymentMethod}
            allowUnknown={entry.paymentMethod === null}
          />
        )}
        <Field label="Tanggal" htmlFor="entry-date">
          <input id="entry-date" type="date" className={INPUT} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={isCorrection ? "Keterangan (wajib)" : "Catatan (opsional)"} htmlFor="entry-note">
          <input id="entry-note" className={INPUT} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <p className="text-ink-faint text-xs">Dicatat oleh {entry.createdByName}</p>
        {error && <p className="text-danger text-sm">{error}</p>}
      </div>
    </Sheet>
  );
}
