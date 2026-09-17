import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/get-current-user";
import { buildMieReportWorkbook } from "@/lib/mie/build-mie-report-workbook";
import { localDateStr } from "@/lib/timezone";

// Independent entry point from every /note page — needs its own
// requireRole("OWNER") first line (see CLAUDE.md "Server-side
// authorization"): a page-level redirect doesn't protect this URL.
export async function GET() {
  await requireRole("OWNER");

  const workbook = await buildMieReportWorkbook();
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `catatan-mi-mentah-${localDateStr(new Date())}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
