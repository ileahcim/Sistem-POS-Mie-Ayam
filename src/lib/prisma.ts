import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Runtime queries go through DATABASE_URL, the POOLED Supabase connection
// (PgBouncer transaction mode) — safe for many short-lived serverless
// invocations on Vercel. Migrations use DIRECT_URL instead (prisma.config.ts).
//
// DATABASE_SCHEMA is for local testing only (docs/working-rules.md: every
// test runs in a temporary `<name>_test` schema, never `public`). Unset —
// as on Vercel — Prisma uses the URL's default schema, exactly as before.
const schema = process.env.DATABASE_SCHEMA?.trim();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL }, schema ? { schema } : undefined);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
