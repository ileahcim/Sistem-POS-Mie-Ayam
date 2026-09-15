import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma CLI commands (migrate, db push, studio) must go through the DIRECT
// (non-pooled) Supabase connection. Supabase's pooler runs in PgBouncer
// transaction mode, which does not support the DDL / session features that
// migrations need. The app's runtime queries use DATABASE_URL (the pooled
// connection) instead — see src/lib/prisma.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
