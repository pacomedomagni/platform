# ADR 0001: Normalized ledgers are the source of truth

## Status
Accepted

## Context
We currently have two parallel storage models:
1) dynamic DocType tables (`tab<DocType>`) used for CRUD/UI
2) normalized ERP tables for inventory/accounting

To build a product-grade ERP, inventory/accounting correctness must be guaranteed and queryable efficiently.

## Decision
- **Normalized tables are the source of truth** for masters/ledgers/balances.
- DocTypes remain for **document UI + workflow**, but do not directly represent stock/GL state.
- Posting to inventory/GL happens only through the posting engine (services), never via ad-hoc SQL in hooks.

## Consequences
- Master DocTypes must sync into normalized masters (Item/Warehouse/etc.), or normalized masters must be exposed directly with dedicated UI.
- Reporting and storefront read from normalized tables.
- We need explicit cancel/reversal rules and idempotency in the posting engine.

