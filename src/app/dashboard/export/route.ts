import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/get-current-user";
import { buildReportWorkbook } from "@/lib/dashboard/build-report-workbook";

// Independent entry point from the dashboard page itself — needs its own
// requireRole("OWNER") first line (see CLAUDE.md "Server-side
// authorization"): the page's redirect doesn't protect this URL.
export async function GET() {
  await requireRole("OWNER");

  const workbook = await buildReportWorkbook();
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `laporan-pos-mi-ayam-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
