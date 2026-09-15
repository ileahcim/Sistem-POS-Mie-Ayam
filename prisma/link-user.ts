import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Role } from "../src/generated/prisma/client";
import { USERNAME_PATTERN, usernameToEmail } from "../src/lib/auth/username";

// Bootstraps/updates a public.User profile row for an existing Supabase Auth
// user. Staff accounts are provisioned by the owner via the Supabase
// dashboard (Authentication -> Add user, with "Auto Confirm" on) — there is
// no public sign-up flow. This script only ever touches our own `public`
// schema; Supabase Auth (`auth.users`) is untouched.
//
// IMPORTANT: the auth user's actual email in Supabase must match
// usernameToEmail(username) below (e.g. username "owner" -> owner@warung.local)
// or login will fail, since the login form derives the email from the
// username. Fix it under Authentication -> Users -> (user) -> edit email if
// it doesn't match yet.
//
// Usage: npx tsx prisma/link-user.ts <authUserId> "<name>" <username> <OWNER|CASHIER>

const [authUserId, name, username, roleArg] = process.argv.slice(2);

if (!authUserId || !name || !username || !roleArg) {
  console.error(
    'Usage: npx tsx prisma/link-user.ts <authUserId> "<name>" <username> <OWNER|CASHIER>',
  );
  process.exit(1);
}

if (roleArg !== "OWNER" && roleArg !== "CASHIER") {
  console.error(`Invalid role "${roleArg}" — must be OWNER or CASHIER.`);
  process.exit(1);
}
const role = roleArg as Role;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidPattern.test(authUserId)) {
  console.error(`"${authUserId}" doesn't look like a UUID — copy the User UID from the Supabase dashboard.`);
  process.exit(1);
}

if (!USERNAME_PATTERN.test(username)) {
  console.error(
    `"${username}" isn't a valid username — lowercase letters, digits, "._-" only, 3-32 chars.`,
  );
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.upsert({
    where: { authUserId },
    update: { name, username, role },
    create: { authUserId, name, username, role },
  });
  console.log(`Linked: ${user.name} (@${user.username}, ${user.role}) -> authUserId ${user.authUserId}`);
  console.log(`Make sure the Supabase auth user's email is exactly: ${usernameToEmail(username)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
