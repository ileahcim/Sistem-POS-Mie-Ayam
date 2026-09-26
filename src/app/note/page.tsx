import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getMieTodayActivity } from "@/lib/mie/get-mie-today-activity";
import { getHeaderNav } from "@/lib/header/get-header-nav";
import { NoteTodayScreen } from "@/components/note/note-today-screen";

// Hari Ini tab — where Note opens. OWNER only, checked server-side here —
// see CLAUDE.md "Server-side authorization". Every action in note/actions.ts
// also requireRole("OWNER") itself, since those are independent entry points
// this redirect doesn't protect. `?baru=` = the entry just saved, highlighted.
export default async function NotePage({ searchParams }: { searchParams: Promise<{ baru?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") redirect("/kasir");

  const [{ baru }, activity, nav] = await Promise.all([searchParams, getMieTodayActivity(), getHeaderNav()]);
  return <NoteTodayScreen book="mie" activity={activity} highlightId={baru ?? null} nav={nav} />;
}
