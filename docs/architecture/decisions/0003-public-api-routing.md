# ADR 0003: Canonical public API path

## Status
Accepted

## Context
Clients currently mix `/api/v1` and `/api` + `/v1` conventions.

## Decision
- Canonical API base path is **`/api/v1`**.
  - Nest global prefix `api`
  - controllers under `v1`
- Frontends should call `/api/v1/...` (absolute) or use a client with `baseURL=/api` and request `/v1/...`.

## Consequences
- All clients must be consistent to avoid environment-specific bugs.

