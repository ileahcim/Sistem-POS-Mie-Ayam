"use client";

import { useState } from "react";
import type { PrinterDriver } from "@/lib/printing/types";
import { openCashDrawer } from "@/lib/printing/cash-drawer";
import { Button } from "@/components/ui/button";

// "Buka Laci" by hand (Kasir screen, every role — owner's call 2 Nov 2026)
// and "Tes Buka Laci" (Pengaturan). Result shows in DrawerNoticeHost.
export function OpenDrawerButton({
  printerDriver,
  label = "Buka Laci",
  size = "compact",
  className,
}: {
  printerDriver: PrinterDriver;
  label?: string;
  size?: "compact" | "default";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size={size}
      disabled={busy}
      className={className}
      onClick={async () => {
        setBusy(true);
        await openCashDrawer(printerDriver);
        setBusy(false);
      }}
    >
      {busy ? "Membuka..." : label}
    </Button>
  );
}
