"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { openShift } from "@/app/shift/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RupiahInput } from "@/components/ui/rupiah-input";
import { SignOutButton } from "@/components/auth/sign-out-button";

export function BukaShiftForm({ isOwner }: { isOwner: boolean }) {
  const router = useRouter();
  const [openingCash, setOpeningCash] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await openShift(Number(openingCash));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/kasir");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-canvas flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <Card padded className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <h1 className="text-center text-xl font-bold text-ink">Buka Shift</h1>
          <div className="flex flex-col gap-1">
            <label htmlFor="openingCash" className="text-sm font-medium text-ink">
              Modal Awal Laci
            </label>
            <RupiahInput id="openingCash" value={openingCash} onChange={setOpeningCash} className="h-14" />
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button type="submit" variant="primary" size="large" fullWidth disabled={saving || openingCash === ""}>
            {saving ? "Membuka..." : "Buka Shift"}
          </Button>
        </form>
      </Card>

      {/* Pre-order tidak butuh shift terbuka (order borongan lewat WhatsApp
          malam hari saat warung tutup) — jadi harus tetap bisa dijangkau
          dari sini, satu-satunya layar yang pasti kebuka sebelum shift ada.
          Note (Mi Mentah & Frozen) juga tidak butuh shift (uangnya terpisah
          total dari kasir — lihat CLAUDE.md "Catatan Mi Mentah") dan sering
          dicatat pagi hari sebelum warung buka, jadi butuh jalan masuk yang
          sama — tapi OWNER only, sama seperti /note sendiri. */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link href="/pesanan-terjadwal" className="rounded-pill bg-muted flex h-12 items-center px-4 text-sm font-semibold text-ink">
          Pesanan Terjadwal
        </Link>
        {isOwner && (
          <Link href="/note" className="rounded-pill bg-muted flex h-12 items-center px-4 text-sm font-semibold text-ink">
            Note
          </Link>
        )}
        <SignOutButton />
      </div>
    </div>
  );
}
