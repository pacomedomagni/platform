# Architecture overview

## Domains
- **Meta / DocTypes**: dynamic document definitions, UI forms, generic CRUD, workflow states.
- **ERP Core (normalized)**: masters and ledgers for inventory + accounting.
- **Posting Engine**: the only component allowed to write to ledgers/balances.

## Source of truth
- Stock truth = `stock_ledger_entries` + derived aggregates (`warehouse_item_balances`, `bin_balances`, `stock_fifo_layers`).
- Accounting truth = `gl_entries` + derived aggregates (future).
- DocType tables (`tab*`) are **not** the truth for stock or GL; they are the UI/workflow layer.

## Key invariants
- Tenant isolation is enforced at DB level (RLS) and at app level by setting `app.tenant`.
- Ledger writes are append-only.
- Posting is idempotent.
- Cancellations are reversals and must be safe (may be blocked).

