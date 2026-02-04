# Platform ERP roadmap

This repository is evolving from a metadata-driven prototype into a product-grade ERP.

## Product principles (non-negotiables)
- **Normalized masters + ledgers are the source of truth** (items, warehouses, locations, batches, stock ledger, FIFO layers, GL).
- **Documents are inputs/workflow** (DocTypes are UI + validation + approvals) and must post through a single posting engine.
- **Append-only ledgers** (no in-place edits to stock/GL history); changes happen via **reversal documents**.
- **Idempotent posting** (submitting the same document twice must not double-post).
- **No negative stock** (hard block at posting time).
- **Tenant isolation** (RLS + explicit tenant context).

## Milestones

### M0 — Architecture lock-in (now)
- ADRs for source-of-truth, posting/cancellation, and API routing.
- Standardize the public API path and client usage.
- Establish schema migration and seed discipline.

### M1 — Inventory core (product-grade)
**Goal:** reliable inventory that supports multi-location + batch + FIFO/FEFO and is safe under concurrency.

- Masters
  - Item: stock/batch/serial flags; basic UOM placeholder.
  - Warehouse + Location tree: defaults for receiving/picking; allow more locations.
  - Batch: expiry date (for FEFO).
- Posting engine
  - Purchase Receipt: receive into a location; create FIFO layers.
  - Delivery Note: issue by FIFO/FEFO; block insufficient stock; optional batch constraint.
  - Stock Transfer: move between locations/warehouses.
  - Stock Reconciliation: adjustments with reasons.
- Correctness
  - **Idempotency keys** per posting.
  - **Cancellations**: reversible postings; block cancel when it would break history (e.g. cancel receipt already consumed).
  - Concurrency controls for layer consumption (row locks/advisory locks).
- Reporting (minimum)
  - Stock balance by warehouse/location/batch.
  - Stock ledger (filter by item/warehouse/voucher).

### M2 — Sales & Purchases (operational)
- Sales Order (reservation/allocations at warehouse level).
- Purchase Order (incoming).
- Invoicing and payments integration points.
- Simple pricing + taxes (%).

### M3 — Accounting foundation (audit-grade)
- Chart of Accounts templates per tenant.
- Fiscal years/periods; closing rules.
- GL posting engine (double-entry), trial balance, P&L, balance sheet.
- Base currency lock per tenant; multi-currency transactions with rates.

### M4 — Storefront (thin commerce layer)
- Catalog + pricing API (from normalized items).
- Availability API (from warehouse balances).
- Cart/order -> Sales Order flow.

## Operating model
- Each milestone ships with:
  - migrations + seeds
  - API contracts
  - automated tests for posting correctness
  - explicit rollback/cancel rules

