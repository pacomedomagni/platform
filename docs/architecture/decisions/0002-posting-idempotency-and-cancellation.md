# ADR 0002: Posting is idempotent and cancellations are reversals

## Status
Accepted

## Context
ERP operations must be safe under retries, double-clicks, network failures, and background job replays.
Also, historical ledgers must be immutable for auditability.

## Decision
- Every posting writes ledger entries with a **posting key** (idempotency key).
- Submitting the same document again must be a no-op (or return the existing posting result).
- Cancelling a submitted document creates **reversal effects**:
  - issue cancellations re-increment consumed FIFO layers (when possible)
  - receipt cancellations are blocked if the receipt’s layers were already consumed

## Consequences
- Stock ledger entries must record which FIFO layer they affected (for reversible issues).
- FIFO layers must record original quantities (for cancellation checks).

