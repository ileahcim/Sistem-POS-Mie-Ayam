// Staff log in with a username, never an email — Supabase Auth's
// email/password API is used underneath with a synthetic address in this
// domain. The domain isn't a real mailbox: email confirmation and
// email-based password reset must stay OFF in the Supabase project, or
// accounts get stuck unconfirmed with no way to receive the confirmation.
export const SYNTHETIC_EMAIL_DOMAIN = "warung.local";

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export function usernameToEmail(username: string): string {
  return `${username.toLowerCase()}@${SYNTHETIC_EMAIL_DOMAIN}`;
}
