import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export type CurrentUser = {
  id: string;
  authUserId: string;
  username: string;
  name: string;
  role: "OWNER" | "CASHIER";
};

// Resolves the logged-in Supabase user to our own public.User profile row
// (name, role). Returns null when there's no session, the profile row
// hasn't been provisioned yet, or the account was deactivated.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const authUserId = data?.claims?.sub;
  if (!authUserId) return null;

  const user = await prisma.user.findUnique({ where: { authUserId } });
  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    authUserId: user.authUserId,
    username: user.username,
    name: user.name,
    role: user.role,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized: no active session");
  return user;
}

export async function requireRole(role: "OWNER" | "CASHIER"): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== role) throw new Error(`Forbidden: requires role ${role}`);
  return user;
}
