"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openShift } from "@/app/shift/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function BukaShiftForm() {
  const router = useRouter();
  const [openingCash, setOpeningCash] = useState("");
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
    <div className="bg-canvas flex flex-1 items-center justify-center p-6">
      <Card padded className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <h1 className="text-center text-xl font-bold text-ink">Buka Shift</h1>
          <div className="flex flex-col gap-1">
            <label htmlFor="openingCash" className="text-sm font-medium text-ink">
              Modal Awal Laci
            </label>
            <input
              id="openingCash"
              type="number"
              inputMode="numeric"
              required
              min={0}
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              className="rounded-input border-border h-14 border px-4 text-lg"
              placeholder="Rp"
            />
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button type="submit" variant="primary" size="large" fullWidth disabled={saving || !openingCash}>
            {saving ? "Membuka..." : "Buka Shift"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
