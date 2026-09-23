"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { createFrozenCustomer } from "@/app/note/frozen-actions";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { AppHeader } from "@/components/ui/app-header";

export function NewFrozenCustomerForm({ nav }: { nav: HeaderNav }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [initialBalance, setInitialBalance] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await createFrozenCustomer(name, note, initialBalance === "" ? 0 : initialBalance);
    setSaving(false);
    if (!result.ok) return setError(result.error);
    router.push(`/note/frozen/pelanggan/${result.customerId}`);
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader
        nav={nav}
        title="Pelanggan Frozen Baru"
        actions={
          <LinkButton href="/note/frozen" variant="secondary" size="compact">
            Batal
          </LinkButton>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-md flex-col gap-3">
          <Card padded className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-ink-muted text-sm font-medium">Nama pelanggan</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama"
                className="rounded-input border-border h-12 border px-3 text-base"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-ink-muted text-sm font-medium">Keterangan (opsional)</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Mis. reseller KMK Frozen"
                className="rounded-input border-border h-12 border px-3 text-base"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-ink-muted text-sm font-medium">Saldo awal utang (opsional)</span>
              <RupiahInput value={initialBalance} onChange={setInitialBalance} placeholder="0" className="h-12 text-base" />
              <span className="text-ink-faint text-xs">
                Isi kalau pelanggan ini sudah punya utang berjalan dari catatan lama.
              </span>
            </label>

            {error && <p className="text-danger text-sm">{error}</p>}

            <Button variant="primary" size="large" fullWidth disabled={saving || !name.trim()} onClick={handleSave}>
              {saving ? "Menyimpan..." : "Simpan Pelanggan"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
