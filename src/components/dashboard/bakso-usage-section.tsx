import type { BaksoUsageTotals } from "@/lib/dashboard/bakso-usage";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// "Perkiraan Bakso Terpakai" (CLAUDE.md, 24 Sep 2026) — informational
// estimate only, never inventory (no deduction, no low-stock alert; label
// "Perkiraan" says so explicitly). Same shared date-range filter as
// sections 3-6/Jam Sibuk. Recipe numbers behind this are owner-editable
// from Manajemen Menu (bakso-usage-section.tsx there), never hardcoded.
export function BaksoUsageSection({ totals, rangeLabel }: { totals: BaksoUsageTotals; rangeLabel: string }) {
  return (
    <section>
      <h2 className="text-ink mb-2 flex items-center gap-2 text-base font-bold">
        Perkiraan Bakso Terpakai ({rangeLabel})
        <Badge variant="neutral">Perkiraan</Badge>
      </h2>
      <Card padded>
        <p className="text-ink-muted mb-3 text-sm">
          Estimasi dari resep per item, bukan sistem stok — tidak ada pengurangan atau peringatan stok habis. Item
          Custom tidak dihitung.
        </p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-ink text-2xl font-bold">{totals.kecil}</p>
            <p className="text-ink-muted text-sm">Kecil</p>
          </div>
          <div>
            <p className="text-ink text-2xl font-bold">{totals.urat}</p>
            <p className="text-ink-muted text-sm">Urat</p>
          </div>
          <div>
            <p className="text-ink text-2xl font-bold">{totals.telur}</p>
            <p className="text-ink-muted text-sm">Telur</p>
          </div>
        </div>
      </Card>
    </section>
  );
}
