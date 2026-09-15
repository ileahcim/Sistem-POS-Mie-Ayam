import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";

// Kasir is the main working screen for both roles for now — Dashboard
// (stage 11) will give OWNER somewhere else to land later.
export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    // src/proxy.ts should already have redirected here, but a profile row
    // that hasn't been provisioned yet (see prisma/link-user.ts) also lands
    // here even with a valid Supabase session.
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-neutral-700">
          Login Supabase berhasil, tapi belum ada profil staf yang terhubung ke akun ini.
        </p>
        <p className="text-sm text-neutral-500">
          Jalankan <code>npm run db:link-user -- &lt;authUserId&gt; &quot;&lt;nama&gt;&quot;
          &lt;username&gt; &lt;OWNER|CASHIER&gt;</code> untuk menghubungkan akun ini.
        </p>
      </div>
    );
  }

  redirect("/kasir");
}
