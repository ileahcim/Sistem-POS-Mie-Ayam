-- Kitchen ticket ("kertas dapur") feature toggle, default OFF — see
-- CLAUDE.md "Kertas dapur". 22 Sep 2026 is the first real operating day, so
-- this must not change any behaviour until the owner switches it on.
ALTER TABLE "Setting" ADD COLUMN "kitchenTicketEnabled" BOOLEAN NOT NULL DEFAULT false;
