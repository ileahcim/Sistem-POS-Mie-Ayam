import { getSettings } from "@/lib/settings/get-settings";
import { PrintPreviewScreen } from "@/components/printing/print-preview-screen";

// Thin server shell: the preview screen is a client component (it drives
// printers), so the Setting row it needs for the sample's warung identity is
// read here and passed down.
export default async function PrintPreviewPage() {
  const settings = await getSettings();
  return <PrintPreviewScreen settings={settings} />;
}
