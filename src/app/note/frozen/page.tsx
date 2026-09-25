import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getFrozenTodayActivity } from "@/lib/frozen/get-frozen-today-activity";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { NoteTodayScreen } from "@/components/note/note-today-screen";

// Hari Ini tab of the Buku Frozen — where it opens. OWNER only, checked
// server-side here — see CLAUDE.md "Server-side authorization". Every action
// in note/frozen-actions.ts also requireRole("OWNER") itself. `?baru=` = the
// entry just saved, highlighted.
export default async function FrozenPage({ searchParams }: { searchParams: Promise<{ baru?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const [{ baru }, rows, nav] = await Promise.all([searchParams, getFrozenTodayActivity(), getHeaderNav()]);
  return <NoteTodayScreen book="frozen" rows={rows} highlightId={baru ?? null} nav={nav} />;
}
