-- "Retur" in both Note books (26 Sep 2026). Purely additive: one new value on
-- each ledger-kind enum. No existing row changes.
ALTER TYPE "MieLedgerKind" ADD VALUE 'RETURN';

ALTER TYPE "FrozenLedgerKind" ADD VALUE 'RETURN';
