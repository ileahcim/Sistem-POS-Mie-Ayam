import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/get-current-user";
import { buildFrozenReportWorkbook } from "@/lib/frozen/build-frozen-report-workbook";
import { localDateStr } from "@/lib/timezone";

// Independent entry point — needs its own requireRole("OWNER") first line
// (see CLAUDE.md "Server-side authorization"): a page-level redirect
// doesn't protect this URL.
export async function GET() {
  await requireRole("OWNER");

  const workbook = await buildFrozenReportWorkbook();
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `buku-frozen-${localDateStr(new Date())}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
