"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/auth/username";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });

    setLoading(false);
    if (error) {
      setError("Username atau password salah.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="bg-canvas flex flex-1 items-center justify-center p-6">
      <Card padded className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <h1 className="text-center text-xl font-bold text-ink">POS Mi Ayam</h1>
          <p className="text-ink-muted text-center text-sm">Masuk untuk mulai kerja</p>

          <div className="flex flex-col gap-1">
            <label htmlFor="username" className="text-sm font-medium text-ink">
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              autoComplete="username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-input border-border h-12 border px-4 text-base"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-input border-border h-12 border px-4 text-base"
            />
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <Button type="submit" variant="primary" size="large" fullWidth disabled={loading} className="mt-2">
            {loading ? "Masuk..." : "Masuk"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
