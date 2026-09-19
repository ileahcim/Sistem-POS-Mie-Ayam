import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getSettings } from "@/lib/settings/get-settings";
import { PrintPreviewScreen } from "@/components/printing/print-preview-screen";

// OWNER only, checked server-side here — see CLAUDE.md "Server-side
// authorization". The page has no server action of its own (printing runs in
// the browser), so this redirect is its only entry point to protect: it can
// drive the physical printer, which a cashier has no business doing.
//
// Thin server shell: the preview screen is a client component (it drives
// printers), so the Setting row it needs for the sample's warung identity is
// read here and passed down.
export default async function PrintPreviewPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const settings = await getSettings();
  return <PrintPreviewScreen settings={settings} />;
}
