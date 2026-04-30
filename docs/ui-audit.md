# NoSlag Web UI — Comprehensive Audit

**Scope:** every page in `apps/web/src/app/` (98 pages) plus the shared `lib/`, layouts, and route helpers. **No code changes** were made — this is read-only analysis with file:line citations and severity ratings.

**Severity legend**

- 🔴 **blocker** — user can't proceed; flow is dead or silently corrupts data
- 🟠 **broken** — works but is wrong, hostile, or skips a guard
- 🟡 **rough** — works but ugly, fragile, or inconsistent
- 🟢 **cosmetic** — small polish

**How to read this document.** Sections are organized by user journey: onboarding → admin core → marketplace → settings/ops/reports → storefront → cross-cutting. Inside each section, findings carry a stable ID (e.g. **D1**, **M17**) you can cite when triaging. The final section is a prioritized punch list — **start there if you only have time for one section.**

---

## 1. Onboarding & Auth Journey

The first 5–10 screens a new tenant or invited user touches.

### 1.1 [signup/page.tsx](apps/web/src/app/signup/page.tsx)

#### 🔴 S1 — "Create Store" submit silently does nothing on validation error from earlier step

[signup/page.tsx:497-505](apps/web/src/app/signup/page.tsx#L497). The form spans 3 steps. On step 3 (Review), submit fires Zod validation across **all** fields. If validation fails on (say) `password` (regex rule), `form.handleSubmit(onSubmit)` aborts silently. The error attaches to `form.formState.errors.password` but that field's `<p>` only renders inside step 0's JSX — invisible from step 3. **No feedback at all.**

**Fix:** pass an `onInvalid` callback to `handleSubmit` that jumps back to the failing step or surfaces a top-level alert.

#### 🟠 S2 — Validation regex duplicated between Zod schema and `canProceed()`

[signup/page.tsx:14-30](apps/web/src/app/signup/page.tsx#L14) vs [signup/page.tsx:119-128](apps/web/src/app/signup/page.tsx#L119). Same password regex in two places. Drift risk — exactly the bug class that produced the original "all green checkmarks but Continue stays disabled" report.

**Fix:** drive `canProceed()` from `form.formState.isValid` per step, or use `safeParse` against a step-scoped sub-schema.

#### 🔴 S3 — "reset your password" link in the signup-error branch is a 404

[signup/page.tsx:480](apps/web/src/app/signup/page.tsx#L480). Routes to `/forgot-password`. **No such route exists** — only `/storefront/account/forgot-password` does.

**Fix:** create a tenant-admin password reset flow (also see L1).

### 1.2 [onboarding/[tenantId]/page.tsx](apps/web/src/app/onboarding/[tenantId]/page.tsx)

#### 🟠 O1 — Polling never stops if user skips payment

[onboarding/[tenantId]/page.tsx:43-57](apps/web/src/app/onboarding/[tenantId]/page.tsx#L43). Interval clears only when `provisioningStatus === 'READY' || 'FAILED'`. After successful provisioning, if the user opens the page and doesn't act, polling continues every 2 seconds indefinitely.

**Fix:** clear the interval once `READY` regardless of payment status; re-poll only on user action.

#### 🟠 O2 — Skip-for-now bypasses backend `onboardingStep` update

[onboarding/[tenantId]/page.tsx:93-95](apps/web/src/app/onboarding/[tenantId]/page.tsx#L93). `handleSkipForNow` just `router.push('/app')`. The server's `onboardingStep` field is never advanced. Anything else reading "is onboarding complete" sees the user as stuck mid-onboarding forever.

**Fix:** call `/onboarding/{id}/complete` with `skipped: true` (or whatever the backend expects) before navigating.

### 1.3 [onboarding/[tenantId]/complete/page.tsx](apps/web/src/app/onboarding/[tenantId]/complete/page.tsx)

#### 🔴 C1 — `/complete` POST fires on every mount with no idempotency guard

[onboarding/complete/page.tsx:16-47](apps/web/src/app/onboarding/[tenantId]/complete/page.tsx#L16). `useEffect` POSTs immediately. Reload during the 3-second redirect window double-completes.

**Fix:** sessionStorage flag or backend idempotency.

#### 🟠 C2 — Hostile 3-second auto-redirect with leaking timer

[onboarding/complete/page.tsx:39](apps/web/src/app/onboarding/[tenantId]/complete/page.tsx#L39). Hard `setTimeout(..., 3000)` then `router.push('/app')`. User can't read the success message; if they navigate away the timer still fires and forcibly redirects them.

**Fix:** Add a "Continue to dashboard" button. If you must auto-redirect, return the timer ID from the effect and clear it on cleanup.

### 1.4 [login/page.tsx](apps/web/src/app/login/page.tsx)

#### 🔴 L1 — "Forgot password?" link is a 404

[login/page.tsx:90](apps/web/src/app/login/page.tsx#L90). Links to `/forgot-password`. **No such page exists.** Only `/storefront/account/forgot-password` (customer-facing).

**Fix:** create `/forgot-password` (or `/login/forgot-password`).

#### 🟠 L2 — Tokens stored in `localStorage` (XSS-readable)

[login/page.tsx:28-35](apps/web/src/app/login/page.tsx#L28). Industry-standard for SPAs but a security trade-off; every page in the app shares this pattern.

### 1.5 [onboarding/accept-invite/[token]/page.tsx](apps/web/src/app/onboarding/accept-invite/[token]/page.tsx)

#### 🟠 I1 — Invite password validation is weaker than signup

[accept-invite/[token]/page.tsx:78-80](apps/web/src/app/onboarding/accept-invite/[token]/page.tsx#L78). Requires 8+ chars and matching confirm. **Doesn't enforce uppercase/lowercase/digit** like signup does. Tenant invitee can set a weaker password than the tenant owner.

**Fix:** mirror the signup Zod schema; extract a shared password schema.

### 1.6 [app/verify-email/page.tsx](apps/web/src/app/app/verify-email/page.tsx)

#### 🟠 V1 — Verify-email lives under `/app/*` which may be auth-gated

[app/verify-email/page.tsx:23-46](apps/web/src/app/app/verify-email/page.tsx#L23). If the user clicks the email link while not logged in, they hit the admin shell which redirects to `/login`, losing the token from the URL.

**Fix:** verify whether `/app/layout.tsx` or middleware gates the route. If yes, move verification out of `/app/*`.

### 1.7 [app/setup/page.tsx](apps/web/src/app/app/setup/page.tsx)

#### 🟠 SE1 — Stuck on Skeleton if any of 4-6 doctype calls hangs

[app/setup/page.tsx:33-53](apps/web/src/app/app/setup/page.tsx#L33). `Promise.allSettled` with no timeout. One slow API → user sits with a Skeleton forever.

#### 🟡 SE2 — Rejected calls silently render `0` records

[app/setup/page.tsx:40-45](apps/web/src/app/app/setup/page.tsx#L40). Distinguishes nothing between "no data" and "couldn't load."

#### 🟢 SE3 — "View Setup Guide" button is decorative

[app/setup/page.tsx:66](apps/web/src/app/app/setup/page.tsx#L66). No `onClick`, no `Link`. Dead button.

### 1.8 [app/getting-started/page.tsx](apps/web/src/app/app/getting-started/page.tsx) (1122 lines)

#### 🟠 G1 — Bare-fetch auth pattern with no 401 refresh

Six fetch sites in [app/getting-started/page.tsx:163-413](apps/web/src/app/app/getting-started/page.tsx#L163). Every one builds `authHeaders()` inline. No central 401 handling — if token expires mid-onboarding, user gets generic errors and doesn't know to re-login.

**Fix:** route through the Axios singleton.

#### 🟠 G3 — Custom-domain field has local-only validation, no backend pre-check

[app/getting-started/page.tsx:730](apps/web/src/app/app/getting-started/page.tsx#L730). User can enter `not a domain` and the UI accepts it locally; the verify call returns whatever the API says. Field has no format hint.

### 1.9 [app/page.tsx](apps/web/src/app/app/page.tsx) (Dashboard)

#### 🔴 D1 — Checklist's "Verify your email" link is a 404

[app/page.tsx:251](apps/web/src/app/app/page.tsx#L251). `href: '/app/settings/account'`. **Page doesn't exist.** Only `/app/settings/{store,payments,shipping,legal}` exist.

**Fix:** create `/app/settings/account`, or change the href to `/app/users` or `/app/verify-email`.

#### 🟠 D2 — `handlePublish` does `window.location.reload()`

[app/page.tsx:237-238](apps/web/src/app/app/page.tsx#L237). Drops React state, scroll position, in-flight requests. Just re-call `fetchDashboard()`.

#### 🟠 D3 — Bare `fetch()` with manual auth, no refresh

[app/page.tsx:84](apps/web/src/app/app/page.tsx#L84), 227, 255, 321. 401 branch hard-redirects to `/login` even when refresh would have worked.

#### 🟠 D4 — `unwrapJson(await res.json())` HTML-500 crash

[app/page.tsx:98](apps/web/src/app/app/page.tsx#L98), 235. If a proxy returns an HTML error page (the bug class that already hit during initial Docker startup), `res.json()` throws SyntaxError instead of surfacing the real status.

#### 🟠 D5 — Empty-state inconsistency: new tenant sees both "Welcome!" card AND checklist

[app/page.tsx:481](apps/web/src/app/app/page.tsx#L481). Both render simultaneously when revenue/orders/products are 0.

---

## 2. Tenant Admin Core

### 2.1 [app/products/page.tsx](apps/web/src/app/app/products/page.tsx)

Mostly clean — uses Axios, URL-stateful filters, debounced search, ConfirmDialog.

#### 🟢 P1 — Sort dir cast accepts garbage

[app/products/page.tsx:64](apps/web/src/app/app/products/page.tsx#L64). `(searchParams.get('dir') as 'asc' | 'desc' | null) ?? 'desc'` — `?dir=foo` is forwarded to API.

### 2.2 [app/products/new/page.tsx](apps/web/src/app/app/products/new/page.tsx)

#### 🟠 PN1 — Image upload error aggregation lies

[app/products/new/page.tsx:118-144](apps/web/src/app/app/products/new/page.tsx#L118). `for` loop + `setError` inside catch — 4 of 5 failures show only the *last* error. Spinner clears even if some failed.

#### 🟠 PN2 — Bare fetch + manual auth across the file

[app/products/new/page.tsx:75-82, 89, 124, 192](apps/web/src/app/app/products/new/page.tsx#L75). Token expiry mid-form = "Failed to create product" + lost typed work. `useUnsavedChanges` doesn't help if the redirect on the next nav triggers a stale 401.

#### 🟠 PN3 — Validation surfaces but doesn't focus the failing field

[app/products/new/page.tsx:157-165](apps/web/src/app/app/products/new/page.tsx#L157). Red banner at the top of a long form; no scroll, no focus shift.

### 2.3 [app/products/[id]/edit/page.tsx](apps/web/src/app/app/products/[id]/edit/page.tsx)

#### 🟠 PE1 — Bare fetch (same class as PN2)

[app/products/[id]/edit/page.tsx:74, 91, 138, 211](apps/web/src/app/app/products/[id]/edit/page.tsx#L74).

#### 🟡 PE4 — No `<form>` element / no Enter-to-submit

[app/products/[id]/edit/page.tsx:282-573](apps/web/src/app/app/products/[id]/edit/page.tsx#L282). Whole form is `<div>`s. `required` attributes never trigger.

### 2.4 [app/products/[id]/variants/page.tsx](apps/web/src/app/app/products/[id]/variants/page.tsx)

#### 🔴 PV1 — Bulk variant generation creates serially with no rollback

[app/products/[id]/variants/page.tsx:206-217](apps/web/src/app/app/products/[id]/variants/page.tsx#L206). 5×5×5 = 125 sequential POSTs. Mid-loop failure leaves partial variants on the server. No bulk endpoint, no progress UI past the spinner.

#### 🟠 PV2 — Delete error silently logged

[app/products/[id]/variants/page.tsx:55-66](apps/web/src/app/app/products/[id]/variants/page.tsx#L55). `console.error` only — no toast. The variant remains in the list and the dialog closes.

#### 🟠 PV3 — Stock-update error silent (same pattern)

[app/products/[id]/variants/page.tsx:68-75](apps/web/src/app/app/products/[id]/variants/page.tsx#L68).

### 2.5 [app/products/import/page.tsx](apps/web/src/app/app/products/import/page.tsx)

#### 🟠 PI1 — Bare fetch for upload + polling

[app/products/import/page.tsx:43, 78](apps/web/src/app/app/products/import/page.tsx#L43). Token expiry kills polling silently. Job appears frozen forever.

#### 🟠 PI2 — Polling has no max-attempts cap

[app/products/import/page.tsx:97](apps/web/src/app/app/products/import/page.tsx#L97). Polls every 2 seconds indefinitely if the backend silently drops the job.

### 2.6 [app/orders/page.tsx](apps/web/src/app/app/orders/page.tsx)

Mostly clean.

#### 🟡 O2 — `Promise.all` for orders + stats: stats failure kills the whole try

[app/orders/page.tsx:93-103](apps/web/src/app/app/orders/page.tsx#L93). Should be `allSettled`.

#### 🟡 O3 — Auto-refresh interval keeps running on hidden tab

[app/orders/page.tsx:120-124](apps/web/src/app/app/orders/page.tsx#L120). `setInterval(loadOrders, 30s)` doesn't pause when document is hidden.

### 2.7 [app/orders/[id]/page.tsx](apps/web/src/app/app/orders/[id]/page.tsx)

#### 🔴 OD1 — Next.js 16 `params` Promise unwrapping missing

[app/orders/[id]/page.tsx:55, 68, 192](apps/web/src/app/app/orders/[id]/page.tsx#L55). Synchronous `params.id` access. Will break in Next 16.

#### 🟠 OD2 — Initial load failure renders "Order not found" misdirection

[app/orders/[id]/page.tsx:74-78](apps/web/src/app/app/orders/[id]/page.tsx#L74). API failure indistinguishable from real 404.

#### 🟠 OD4 — `adminNotes` initialized as `''` and never populated from the loaded order

[app/orders/[id]/page.tsx:59, 171-184](apps/web/src/app/app/orders/[id]/page.tsx#L59). Existing notes on the server are not displayed; saving will overwrite. **Real bug.**

#### 🟢 OD6 — Print invoice = `window.print()`

[app/orders/[id]/page.tsx:186-188](apps/web/src/app/app/orders/[id]/page.tsx#L186). Prints sidebar/header/filters along with the order.

### 2.8 [app/customers/page.tsx](apps/web/src/app/app/customers/page.tsx)

No issues found.

### 2.9 [app/customers/[id]/page.tsx](apps/web/src/app/app/customers/[id]/page.tsx)

#### 🔴 CD1 — Same Next.js 16 `params` Promise issue

[app/customers/[id]/page.tsx:62, 86-87, 135](apps/web/src/app/app/customers/[id]/page.tsx#L62).

#### 🟠 CD3 — `totalSpent` computed client-side from one paginated page of orders

[app/customers/[id]/page.tsx:103-112](apps/web/src/app/app/customers/[id]/page.tsx#L103). Customer with 51+ orders sees wrong total.

### 2.10 [app/inventory/page.tsx](apps/web/src/app/app/inventory/page.tsx)

#### 🟠 INV1 — Mixed `fetch` (alerts) + Axios (rest)

[app/inventory/page.tsx:111-119](apps/web/src/app/app/inventory/page.tsx#L111). Asymmetric refresh — token expires, alerts call dies silently while others retry.

#### 🟠 INV2 — Two-of-three failure renders partial dashboard with no warning

[app/inventory/page.tsx:110, 123-142](apps/web/src/app/app/inventory/page.tsx#L110).

### 2.11 [app/inventory/batches/page.tsx](apps/web/src/app/app/inventory/batches/page.tsx)

#### 🟠 IB2 — Pagination broken: `setPage(p+1); loadBatches()` reads stale page

[app/inventory/batches/page.tsx:297, 305](apps/web/src/app/app/inventory/batches/page.tsx#L297). State updates are async. **Clicking Next loads the same page.**

**Fix:** `useEffect` on `[batchPage]`, or pass the new page directly.

### 2.12 [app/inventory/movements/page.tsx](apps/web/src/app/app/inventory/movements/page.tsx)

#### 🟠 IM1 — Same broken pagination as IB2

[app/inventory/movements/page.tsx:304, 312](apps/web/src/app/app/inventory/movements/page.tsx#L304).

#### 🟠 IM2 — `movement.rate.toFixed(2)` crashes if rate is null

[app/inventory/movements/page.tsx:285](apps/web/src/app/app/inventory/movements/page.tsx#L285).

### 2.13 [app/inventory/serials/page.tsx](apps/web/src/app/app/inventory/serials/page.tsx)

#### 🟠 IS1 — Same broken pagination as IB2

[app/inventory/serials/page.tsx:361, 369](apps/web/src/app/app/inventory/serials/page.tsx#L361).

### 2.14 [app/earnings/page.tsx](apps/web/src/app/app/earnings/page.tsx)

#### 🟠 E1 — `window.location.href = '/login'` instead of `router.push`

[app/earnings/page.tsx:110, 123](apps/web/src/app/app/earnings/page.tsx#L110). Hard navigation drops React state.

#### 🟠 E2 — Bare fetch + manual auth (PN2 class)

[app/earnings/page.tsx:114, 145](apps/web/src/app/app/earnings/page.tsx#L114).

### 2.15 [app/reviews/page.tsx](apps/web/src/app/app/reviews/page.tsx)

#### 🟠 R2 — Moderate / bulk-moderate / response failures silent

[app/reviews/page.tsx:43-49, 52-62, 64-75](apps/web/src/app/app/reviews/page.tsx#L43). `console.error` only. The list reloads even on failure — merchant clicks Approve, sees no change, has no idea why.

#### 🟡 R3 — Search is purely client-side

[app/reviews/page.tsx:139-148](apps/web/src/app/app/reviews/page.tsx#L139). Filters in memory over the *current* page. Search across all reviews is impossible.

### 2.16 [app/users/page.tsx](apps/web/src/app/app/users/page.tsx)

#### 🟢 U3 — `selectable` DataTable but no `bulkActions` rendered

[app/users/page.tsx:387-389](apps/web/src/app/app/users/page.tsx#L387). Selection works but does nothing.

### 2.17 [app/themes/page.tsx](apps/web/src/app/app/themes/page.tsx)

#### 🔴 T1 — Preview iframe never reflects the previewed theme

[app/themes/page.tsx:50-54, 319-322](apps/web/src/app/app/themes/page.tsx#L50). Code comment admits the storefront doesn't honor `?theme=`. Preview always shows the *currently active* theme. Worse, the description tells the user it'll work "once the storefront supports per-request overrides" — no indication that today it's a no-op.

#### 🟠 T2 — Two competing delete dialogs with contradictory copy

[app/themes/page.tsx:279-298, 301-308](apps/web/src/app/app/themes/page.tsx#L279). Delete dialog says "This action cannot be undone" but the surrounding code uses `toastUndo` (5-second undo).

### 2.18 [app/themes/[id]/page.tsx](apps/web/src/app/app/themes/[id]/page.tsx)

#### 🟠 TC1 — Keyboard shortcut handler captures stale closures

[app/themes/[id]/page.tsx:67-83](apps/web/src/app/app/themes/[id]/page.tsx#L67). `useEffect` deps only `[params.id]` — handlers reference `currentTheme`, `isDirty`. Cmd+S after subsequent edits *might* save the original snapshot.

#### 🟠 TC3 — Escape always closes (with confirm if dirty), bubbles from subdialogs

[app/themes/[id]/page.tsx:76-78](apps/web/src/app/app/themes/[id]/page.tsx#L76). Pressing Escape inside a subdialog (ColorPicker popover) bubbles up and triggers `handleClose`, prompting unsaved-changes dialog. Hostile.

### 2.19 [app/studio/page.tsx](apps/web/src/app/app/studio/page.tsx)

#### 🟠 S2 — Initial fetch error silent

[app/studio/page.tsx:17-19](apps/web/src/app/app/studio/page.tsx#L17). `console.error` then renders empty Studio. Blank canvas with no hint API died.

#### 🟠 S3 — `Documentation` button is decorative

[app/studio/page.tsx:46](apps/web/src/app/app/studio/page.tsx#L46). No `onClick`, no `Link`. Dead button.

### 2.20 [app/[doctype]/page.tsx](apps/web/src/app/app/[doctype]/page.tsx)

#### 🔴 DT1 — Native `confirm()` for bulk delete

[app/[doctype]/page.tsx:47](apps/web/src/app/app/[doctype]/page.tsx#L47). Browser-native dialog. Inconsistent with the rest of the app's `ConfirmDialog`.

#### 🟠 DT3 — Initial fetch errors silent → "DocType not found" misdirection

[app/[doctype]/page.tsx:21-23, 33-35](apps/web/src/app/app/[doctype]/page.tsx#L21).

### 2.21 [app/[doctype]/[name]/page.tsx](apps/web/src/app/app/[doctype]/[name]/page.tsx)

#### 🔴 DTN1 — Submit / cancel handlers throw unhandled

[app/[doctype]/[name]/page.tsx:61-71](apps/web/src/app/app/[doctype]/[name]/page.tsx#L61). `handleSubmit` and `handleCancel` have no try/catch. If `api.put` rejects, error propagates to the nearest error boundary. No toast.

#### 🟠 DTN3 — `decodeURIComponent` can throw on malformed URI

[app/[doctype]/[name]/page.tsx:12](apps/web/src/app/app/[doctype]/[name]/page.tsx#L12). URL like `/app/foo/%E0%A4%A` throws URIError, crashing the page.

---

## 3. Marketplace (eBay)

### 3.1 [app/marketplace/page.tsx](apps/web/src/app/app/marketplace/page.tsx)

#### 🟠 M1 — One transient failure forces global `errored=true`

[app/marketplace/page.tsx:73, 78, 95](apps/web/src/app/app/marketplace/page.tsx#L73). Should degrade per-card.

#### 🟢 M3 — Unused import `RotateCcw`

### 3.2 [app/marketplace/connections/page.tsx](apps/web/src/app/app/marketplace/connections/page.tsx)

#### 🔴 M8 — OAuth callback failure leaves a half-connected ghost row

[app/marketplace/connections/page.tsx:104-110](apps/web/src/app/app/marketplace/connections/page.tsx#L104). After `handleCreateConnection` POSTs, immediately redirects to OAuth. If OAuth fails, on return the row exists as `isConnected=false` with no clear retry.

### 3.3 [app/marketplace/listings/page.tsx](apps/web/src/app/app/marketplace/listings/page.tsx)

#### 🔴 M17 — Status filter mismatch breaks deep-link from dashboard

[app/marketplace/listings/page.tsx:267-273](apps/web/src/app/app/marketplace/listings/page.tsx#L267). Filter values are lowercase (`draft`, `published`, `error`). Dashboard at [app/page.tsx:205](apps/web/src/app/app/page.tsx#L205) links via `?status=ERROR` (UPPERCASE). The component never reads `?status=` from the URL anyway. **Deep-links from the dashboard do nothing.**

### 3.4 [app/marketplace/listings/new/page.tsx](apps/web/src/app/app/marketplace/listings/new/page.tsx)

#### 🔴 M23 — Schedule field name mismatch

[app/marketplace/listings/new/page.tsx:872](apps/web/src/app/app/marketplace/listings/new/page.tsx#L872) sends `scheduledDate`. Detail page at [app/marketplace/listings/[id]/page.tsx:688](apps/web/src/app/app/marketplace/listings/[id]/page.tsx#L688) sends `scheduledAt`. **One is wrong.** Schedule failure is swallowed by the secondary try/catch — user lands on success route believing scheduling worked.

#### 🟠 M26 — Image URL fallback silently bypasses validation

[app/marketplace/listings/new/page.tsx:626-634](apps/web/src/app/app/marketplace/listings/new/page.tsx#L626). When `/media/upload-url` 4xx (size, MIME, security check), the page falls back to adding the raw URL to photos. eBay later rejects the listing at submit time with an opaque error.

#### 🟠 M29 — Item-specifics for `SELECTION_ONLY` aspects rendered as free text

[app/marketplace/listings/new/page.tsx:732-734](apps/web/src/app/app/marketplace/listings/new/page.tsx#L732). User typing "Color: Red, Blue" sends `["Red", "Blue"]` for a single-value aspect → eBay reject.

#### 🟡 M31 — No unsaved-changes warning on cancel/back

[app/marketplace/listings/new/page.tsx:2557-2563](apps/web/src/app/app/marketplace/listings/new/page.tsx#L2557). Form is 1500+ lines.

#### 🟡 M33 — Currency hardcoded to `$` in price prefixes

[app/marketplace/listings/new/page.tsx:1518, 1573, 1594, 1624](apps/web/src/app/app/marketplace/listings/new/page.tsx#L1518). EBAY_UK should show `£`, EBAY_DE `€`. Detail page does it correctly; create form doesn't.

### 3.5 [app/marketplace/listings/[id]/page.tsx](apps/web/src/app/app/marketplace/listings/[id]/page.tsx)

#### 🔴 M39 — Schedule field name mismatch (paired with M23)

[app/marketplace/listings/[id]/page.tsx:688](apps/web/src/app/app/marketplace/listings/[id]/page.tsx#L688).

#### 🟠 M40 — Edit body wipes platformData fields

[app/marketplace/listings/[id]/page.tsx:570-578](apps/web/src/app/app/marketplace/listings/[id]/page.tsx#L570). Edit form sends only `format` + 3 policy IDs in `platformData`. Existing `platformData.brand/mpn/upc/ean/isbn` (from create flow at [app/marketplace/listings/new/page.tsx:796-802](apps/web/src/app/app/marketplace/listings/new/page.tsx#L796)) **are wiped on save** because the PATCH overwrites the whole object.

#### 🟠 M41 — Edit-mode `categoryId` is a free-text input

[app/marketplace/listings/[id]/page.tsx:1418-1426](apps/web/src/app/app/marketplace/listings/[id]/page.tsx#L1418). User must type a numeric category ID. Create page has a search dropdown.

#### 🟠 M43 — No photo editor on edit listing

[app/marketplace/listings/[id]/page.tsx:1990](apps/web/src/app/app/marketplace/listings/[id]/page.tsx#L1990). Cannot reorder/remove images on an existing listing.

### 3.6 [app/marketplace/orders/page.tsx](apps/web/src/app/app/marketplace/orders/page.tsx)

#### 🔴 M51 — Detail page is unreachable from list

[app/marketplace/orders/page.tsx:421-633](apps/web/src/app/app/marketplace/orders/page.tsx#L421). The expand button toggles inline detail; no link to `/app/marketplace/orders/[id]`. The detail route exists (797 lines, has refund/cancel modals) but is **orphaned dead code** — only reachable by URL guess. Users who want to refund or cancel can't get there.

### 3.7 [app/marketplace/promotions/page.tsx](apps/web/src/app/app/marketplace/promotions/page.tsx)

#### 🔴 M82 — Two prominent "Coming soon" CTAs

[app/marketplace/promotions/page.tsx:217-231, 277-290](apps/web/src/app/app/marketplace/promotions/page.tsx#L217). "Markdown Sale" and "Order Discount" buttons toast "Coming soon". The empty state CTA also doesn't work. Page is read-only / pause-resume only.

### 3.8 [app/marketplace/campaigns/new/page.tsx](apps/web/src/app/app/marketplace/campaigns/new/page.tsx)

#### 🔴 M90 — Listings filter sends wrong status value

[app/marketplace/campaigns/new/page.tsx:74](apps/web/src/app/app/marketplace/campaigns/new/page.tsx#L74). Sends `status=ACTIVE`, but the listings list page sends `status=published` and dashboard sends `status=PUBLISHED`. **Likely matches no listings.** "Select Listings" section is permanently empty for users with published listings.

### 3.9 [app/marketplace/campaigns/[id]/page.tsx](apps/web/src/app/app/marketplace/campaigns/[id]/page.tsx)

#### 🟠 M95 — Remove Ad has no confirmation

[app/marketplace/campaigns/[id]/page.tsx:147-164](apps/web/src/app/app/marketplace/campaigns/[id]/page.tsx#L147). One-click destructive action on a live campaign.

#### 🟠 M97 — Pause/resume/end have no confirm

[app/marketplace/campaigns/[id]/page.tsx:99-119](apps/web/src/app/app/marketplace/campaigns/[id]/page.tsx#L99). End is irreversible per eBay API.

#### 🟢 M100 — Toast says "Campaign endd successfully"

[app/marketplace/campaigns/[id]/page.tsx:107](apps/web/src/app/app/marketplace/campaigns/[id]/page.tsx#L107). `${action}d` produces "endd" for `action='end'`.

### 3.10 [app/marketplace/settings/page.tsx](apps/web/src/app/app/marketplace/settings/page.tsx)

#### 🔴 M123 — Permissions tab has interactive toggles but **no Save button**

[app/marketplace/settings/page.tsx:1054-1133](apps/web/src/app/app/marketplace/settings/page.tsx#L1054). User can flip toggles and apply templates. State lives in component-local — closing tab loses everything. The descriptive text claims "View available permissions" but the toggles are interactive.

#### 🟠 M128 — Edit Location modal silently drops address fields

[app/marketplace/settings/page.tsx:899-950](app/marketplace/settings/page.tsx#L899). When editing, address inputs are hidden behind `{!editingLocation && ...}`. PATCH sends only `name` + `phone`. Users assume Edit lets them change the address; it doesn't, with no UI hint.

---

## 4. Settings · Operations · Reports

### 4.1 [app/settings/store/page.tsx](apps/web/src/app/app/settings/store/page.tsx)

#### 🔴 ST1 — Bare fetch + no token refresh

[app/settings/store/page.tsx:24-32, 54-64](apps/web/src/app/app/settings/store/page.tsx#L24).

#### 🟠 ST3 — Save button never disabled for empty `businessName`

[app/settings/store/page.tsx:148-156](apps/web/src/app/app/settings/store/page.tsx#L148). Posts `""` if user clears the field; backend either rejects with generic error or accepts garbage.

#### 🟡 ST4 — No unsaved-changes warning on Cancel

[app/settings/store/page.tsx:220-225](apps/web/src/app/app/settings/store/page.tsx#L220).

### 4.2 [app/settings/payments/page.tsx](apps/web/src/app/app/settings/payments/page.tsx)

#### 🔴 PA1 — Bare fetch + non-refreshing token (3 sites)

[app/settings/payments/page.tsx:30-32, 60-62, 75-77](apps/web/src/app/app/settings/payments/page.tsx#L30).

#### 🔴 PA2 — Reconnect locks on success if redirect intercepted

[app/settings/payments/page.tsx:71-86](apps/web/src/app/app/settings/payments/page.tsx#L71). On success → `window.location.href = url`, `isReconnecting` not reset. If redirect blocked (popup blocker, slow nav), button stays "Redirecting..." forever.

#### 🟠 PA3 — `window.open(url, '_blank')` for Stripe dashboard with async URL fetch

[app/settings/payments/page.tsx:65](apps/web/src/app/app/settings/payments/page.tsx#L65). Browsers block popups not initiated by user gesture. Async URL fetch breaks this — Safari/Firefox silently block.

#### 🟠 PA5 — Square has no manage button at all

[app/settings/payments/page.tsx:153-170](apps/web/src/app/app/settings/payments/page.tsx#L153). Square user with `active` status sees no actions.

### 4.3 [app/settings/shipping/page.tsx](apps/web/src/app/app/settings/shipping/page.tsx)

#### 🔴 SH1 — Bare fetch (8 sites)

#### 🟠 SH2 — `fetchZones` swallows ALL errors with `// Non-critical` comment

[app/settings/shipping/page.tsx:113-124](apps/web/src/app/app/settings/shipping/page.tsx#L113). User sees "No shipping zones configured" forever even if endpoint 500s. Will start adding duplicate zones on top of existing-but-hidden ones.

#### 🟠 SH3 — Cleared input sends `0` instead of "leave alone"

[app/settings/shipping/page.tsx:138, 144, 145](apps/web/src/app/app/settings/shipping/page.tsx#L138). User types "8.25" then deletes intending to keep it; actually overwrites to 0.

#### 🟠 SH5 — Add Zone with no countries silently succeeds

[app/settings/shipping/page.tsx:172-198](apps/web/src/app/app/settings/shipping/page.tsx#L172). Empty `newZoneCountryCodes` allowed. UI even renders "All countries" for a 0-country zone — directly contradicts the inline help text.

### 4.4 [app/settings/legal/page.tsx](apps/web/src/app/app/settings/legal/page.tsx)

#### 🔴 LE2 — Switching tabs SILENTLY DESTROYS unsaved edits

[app/settings/legal/page.tsx:62-74](apps/web/src/app/app/settings/legal/page.tsx#L62). Effect overwrites `title`, `content`, `isPublished` whenever `activeSlug` changes. **Type 200 lines of TOS, accidentally click Privacy Policy → content gone, no warning, no undo.** Single worst UX bug across all of Settings.

#### 🟠 LE5 — `content` field labelled "HTML supported" with no preview / no sanitization indicator

[app/settings/legal/page.tsx:209-219](apps/web/src/app/app/settings/legal/page.tsx#L209). User pastes HTML, can't tell if `<script>` was stripped, malformed `<br>` rendered, etc.

### 4.5 [app/operations/page.tsx](apps/web/src/app/app/operations/page.tsx)

#### 🟡 OP2 — Audit "entries today" derived from a 1-row endpoint

[app/operations/page.tsx:91, 115-117](apps/web/src/app/app/operations/page.tsx#L91). `auditData?.entriesToday || auditData?.summary?.today || 0`. Neither field is documented to exist. **Always renders `0`.**

### 4.6 [app/operations/import/page.tsx](apps/web/src/app/app/operations/import/page.tsx)

#### 🟠 IM-OP1 — Naive CSV parser breaks on quoted commas

[app/operations/import/page.tsx:46-63](apps/web/src/app/app/operations/import/page.tsx#L46). Splits on `,` and `\n`. `"Smith, John",foo@example.com` becomes 3 cells in preview but the actual import (which posts raw `content` to server) is parsed correctly server-side. **Preview lies to the merchant.**

#### 🟠 IM-OP3 — Whole CSV loaded into memory twice + posted as JSON

[app/operations/import/page.tsx:41, 72](apps/web/src/app/app/operations/import/page.tsx#L41). For a 10MB CSV: read 20MB, ship as JSON body. Most servers reject 10MB+ JSON.

### 4.7 [app/operations/export/page.tsx](apps/web/src/app/app/operations/export/page.tsx)

#### 🔴 EX1 — Date filter only on `orders`; other types stream entire dataset

[app/operations/export/page.tsx:150-179](apps/web/src/app/app/operations/export/page.tsx#L150). 200k products → request hangs → browser kills it. No streaming, no progress.

#### 🟠 EX2 — `responseType: 'blob'` breaks 401 error reading

[app/operations/export/page.tsx:24-26](apps/web/src/app/app/operations/export/page.tsx#L24). Blob `data` field isn't an object — toast says "Export failed: undefined".

### 4.8 [app/operations/jobs/page.tsx](apps/web/src/app/app/operations/jobs/page.tsx)

#### 🟠 JB1 — Polling effect deps churn — restarts interval every keystroke

[app/operations/jobs/page.tsx:147-154](app/operations/jobs/page.tsx#L147). Filter changes regenerate `loadJobs`, restart interval. Tight overlap window can briefly double-fetch.

#### 🟠 JB2 — Polling continues firing 401s after token expires

[app/operations/jobs/page.tsx:149-152](app/operations/jobs/page.tsx#L149). Hammers refresh path every 10s.

### 4.9 [app/operations/audit-logs/page.tsx](apps/web/src/app/app/operations/audit-logs/page.tsx)

#### 🔴 AU1 — Export silently fails

[app/operations/audit-logs/page.tsx:67-90](app/operations/audit-logs/page.tsx#L67). `console.error` only — user clicks Export, nothing happens, no feedback.

#### 🟠 AU2 — Search is client-side only on visible 50 rows

[app/operations/audit-logs/page.tsx:50-58](app/operations/audit-logs/page.tsx#L50). Search "Order ABC123" returns nothing because that order is on page 11. **No pagination at all** — hard `limit: 50`.

### 4.10 [app/operations/notifications/page.tsx](apps/web/src/app/app/operations/notifications/page.tsx)

#### 🔴 NO1 — Every error swallowed with empty `catch {}`

[app/operations/notifications/page.tsx:151, 169, 177, 185, 192](app/operations/notifications/page.tsx#L151). Five action handlers all use empty catches. Optimistic state is shown forever even on failure.

### 4.11 [app/operations/webhooks/page.tsx](apps/web/src/app/app/operations/webhooks/page.tsx)

#### 🔴 WH1 — Create modal has no URL/event/name validation

[app/operations/webhooks/page.tsx:123-148](app/operations/webhooks/page.tsx#L123). User can save a webhook with empty URL, empty events, empty name.

#### 🔴 WH2 — Status pill IS the toggle — easy to disable production webhook

[app/operations/webhooks/page.tsx:342-348](app/operations/webhooks/page.tsx#L342). Click-to-toggle with no confirm. User trying to copy the URL miss-clicks the badge → instant pause → silent loss of events.

#### 🟠 WH5 — Modal loads every delivery ever made (no pagination)

[app/operations/webhooks/page.tsx:114-121](app/operations/webhooks/page.tsx#L114).

### 4.12 Reports — common patterns

#### 🟠 R-COMMON-1 — Free-text inputs for IDs/codes with no autocomplete

10+ reports require typing exact item codes / account names. Typo → empty table → no error.

#### 🟠 R-COMMON-2 — No URL state for filters

None of the reports persist filters to query string. Bookmarking / sharing impossible.

#### 🟠 R-COMMON-3 — Loading state masked: only "Loading..." inside the Load button

Table area shows previous result during re-fetch. Clicking Load is indistinguishable from no-op if data is the same.

#### 🟡 R-COMMON-5 — Numeric values rendered as raw strings

Inventory reports show `"123.4500"` raw — no currency, no thousands separators. Inconsistent with P&L / Balance Sheet which use `formatCurrency`.

#### 🟡 R-COMMON-6 — No CSV export on most non-financial reports

Only analytics/balance-sheet/cash-flow/profit-loss/trial-balance export. The 9 stock/serial/aging/locations/reorder reports cannot be exported.

### 4.13 [app/reports/serials/page.tsx](apps/web/src/app/app/reports/serials/page.tsx)

#### 🟠 SR1 — Status filter is free-text input

[app/reports/serials/page.tsx:57-61](app/reports/serials/page.tsx#L57). Placeholder hints "AVAILABLE/ISSUED" but anything goes. Server probably ignores typos, returning everything; user thinks they have a filter applied.

---

## 5. Storefront (Customer Journey)

### 5.1 [storefront/page.tsx](apps/web/src/app/storefront/page.tsx)

#### 🟡 SF-H1 — "Book a design session" button is dead

[storefront/page.tsx:102](apps/web/src/app/storefront/page.tsx#L102). No `onClick`, no `href`. Same on layout's "Sales inquiry" button at [storefront/layout.tsx:146-152](apps/web/src/app/storefront/layout.tsx#L146).

#### 🟡 SF-H2 — Categories rendered without links

[storefront/page.tsx:43-55](apps/web/src/app/storefront/page.tsx#L43). Cards show `name`, `description`, `productCount` but the entire card is non-clickable — no `<Link>` to `/storefront/products?category=<slug>`.

### 5.2 [storefront/layout.tsx](apps/web/src/app/storefront/layout.tsx)

#### 🟡 SF-L2 — Footer links to legal pages may 404

[storefront/layout.tsx:241-258](apps/web/src/app/storefront/layout.tsx#L241). Footer links `/storefront/pages/terms-of-service`, `/privacy-policy`, `/refund-policy` — CMS pages. If the tenant hasn't published them, `pagesApi.getBySlug()` returns null → `notFound()`.

#### 🟡 SF-L3 — `ERP Suite` footer link points to `/app` (admin)

[storefront/layout.tsx:217](apps/web/src/app/storefront/layout.tsx#L217). Storefront customers can't log into the admin app.

### 5.3 [storefront/products/page.tsx](apps/web/src/app/storefront/products/page.tsx)

#### 🟠 SF-P1 — Search debounce fires for every state change including pagination

[storefront/products/page.tsx:83-112](apps/web/src/app/storefront/products/page.tsx#L83). 300ms `setTimeout(fetchProducts)` runs on every dep change. Concurrent fetches with no cancellation — slow earlier request can resolve **after** a faster later one and clobber `setProducts`.

#### 🟡 SF-P4 — Search query in URL is not synced back

[storefront/products/page.tsx:55](apps/web/src/app/storefront/products/page.tsx#L55). `searchQuery` initialized from `?q=` once; subsequent edits never push to URL. Sharing a filtered result is impossible.

### 5.4 [storefront/products/[slug]/page.tsx](apps/web/src/app/storefront/products/[slug]/page.tsx)

#### 🔴 SF-PD1 — Variant selection is wired but never reaches AddToCart

[storefront/products/[slug]/page.tsx:202-230](apps/web/src/app/storefront/products/[slug]/page.tsx#L202). Page renders `<VariantSelector ... />` but never passes `onVariantChange`. The two `<AddToCartButton>` children receive only `productId`/`productSlug`/`productName` — no `selectedVariant` prop. In the button at line 52, `selectedVariant?.id || productId` always falls back to base product. **Buyers selecting "Red / XL" silently get the default SKU added.** Live purchase-flow bug.

#### 🔴 SF-PD2 — Two AddToCart buttons cause duplicate submissions

[storefront/products/[slug]/page.tsx:219-230](apps/web/src/app/storefront/products/[slug]/page.tsx#L219). Two independent buttons (Add to cart + Buy Now), each with its own `isAdding` state. Near-simultaneous clicks fire two `addItem` calls.

#### 🟠 SF-PD3 — AddToCart button enabled even when product is out-of-stock

[storefront/products/[slug]/page.tsx:210-212, 219-230](storefront/products/[slug]/page.tsx#L210). Stock-status is rendered as text but never gates the buttons.

#### 🟡 SF-PD4 — Lead time hardcoded "3-5 business days"

[storefront/products/[slug]/page.tsx:216](storefront/products/[slug]/page.tsx#L216). Despite the page mapper computing `leadTime`. Lies to the buyer.

### 5.5 [storefront/cart/page.tsx](apps/web/src/app/storefront/cart/page.tsx)

#### 🟠 SF-C1 — Free-shipping threshold hardcoded to $75

[storefront/cart/page.tsx:38](storefront/cart/page.tsx#L38). Magic number unrelated to tenant's actual rules. Tenant running "Free shipping over $50" promotion → cart UI keeps nagging.

#### 🟠 SF-C2 — Quantity changes are not optimistic; spam-clicks fire serial requests

[storefront/cart/page.tsx:49-52](storefront/cart/page.tsx#L49). `+/-` buttons not disabled while in flight. 4 spam-clicks → 4 sequential PATCHes, each refetches cart, each clobbers state.

#### 🟠 SF-C3 — Remove handler doesn't confirm or undo

[storefront/cart/page.tsx:54-56](storefront/cart/page.tsx#L54). Trash icon deletes immediately. Stray click → item gone. The codebase already has `ConfirmDialog` and toast-undo patterns elsewhere.

### 5.6 [storefront/checkout/page.tsx](apps/web/src/app/storefront/checkout/page.tsx) — CRITICAL

#### 🔴 SF-CK1 — Order summary aside doesn't include the chosen shipping rate price

[storefront/checkout/page.tsx:824-863](storefront/checkout/page.tsx#L824). Summary shows `shipping > 0 ? formatCurrency(shipping) : 'Calculated'`. Once the user picks a rate, the price is **never reflected** in the summary or in `total`. Buyers stare at "Calculated" while clicking "Continue to Payment" with no idea what they'll pay.

#### 🔴 SF-CK2 — `state` is required for some countries but optional in schema

[storefront/checkout/page.tsx:521-532](storefront/checkout/page.tsx#L521) and [libs/validation/.../checkout.schema.ts:71](libs/validation/src/lib/schemas/checkout.schema.ts#L71). Missing state for US/CA/AU buyer silently submits → backend rejects or computes wrong tax.

#### 🔴 SF-CK3 — Country dropdown only lists 8 countries; schema is permissive

[libs/validation/.../checkout.schema.ts:73](libs/validation/src/lib/schemas/checkout.schema.ts#L73). Saved-address-prefill with 3-letter ISO ("USA") doesn't match any `<option>` and renders nothing.

#### 🔴 SF-CK4 — Logged-in pre-fill silently overrides buyer's just-typed address

[storefront/checkout/page.tsx:111-131](storefront/checkout/page.tsx#L111). Pre-fill effect fires whenever `customer` changes. If `useAuthStore` re-resolves mid-typing, `setValue('addressLine1', ...)` wipes typed input. No `dirty`-check guard.

#### 🟠 SF-CK5 — `fetchShippingRates` AbortController never wired to fetch

[storefront/checkout/page.tsx:195-202](storefront/checkout/page.tsx#L195). `controller.abort()` returned from cleanup but the signal is never passed to `shippingApi.getRates`. Three rapid edits → three concurrent requests → last to resolve wins.

#### 🟠 SF-CK8 — `onSubmit` doesn't validate `selectedShippingRateId`

[storefront/checkout/page.tsx:231-271](storefront/checkout/page.tsx#L231). If shipping rates failed to load, body just omits `shippingRateId`. Backend rejects with generic error. No inline "please select a shipping method".

#### 🟠 SF-CK11 / 12 — Stripe / Square config-fetch failure → forever spinner

[storefront/checkout/page.tsx:700-717, 681-699](storefront/checkout/page.tsx#L700). If `paymentsApi.getConfig` fails silently (caught and logged on line 106), user lands on payment step with spinner forever.

#### 🟡 SF-CK16 — Country list hardcoded to 8 countries

[storefront/checkout/page.tsx:24-33](storefront/checkout/page.tsx#L24). Buyers in Spain/Japan/India/etc. can't complete checkout.

### 5.7 [storefront/order-confirmation/page.tsx](apps/web/src/app/storefront/order-confirmation/page.tsx)

#### 🟠 SF-OC4 — Reorder loop adds line-item IDs as if they were product IDs

[storefront/order-confirmation/page.tsx:79-83](storefront/order-confirmation/page.tsx#L79). `addItem(item.id, item.quantity)` — `item.id` is the line-item id, not product id. Same bug in [storefront/account/orders/page.tsx:75](storefront/account/orders/page.tsx#L75). Either silently fails (each catch swallows) or adds wrong products. User sees "Items added to cart" toast even when zero items added.

### 5.8 [storefront/account/login/page.tsx](apps/web/src/app/storefront/account/login/page.tsx)

#### 🟠 SF-LG1 — Redirect target is not validated; open-redirect risk

[storefront/account/login/page.tsx:20, 41](storefront/account/login/page.tsx#L20). `searchParams.get('redirect')` is pushed unsanitized. `?redirect=https://evil.com` could become an open-redirect under future Next changes.

### 5.9 [storefront/account/register/page.tsx](apps/web/src/app/storefront/account/register/page.tsx)

#### 🟠 SF-RG2 — Successful registration doesn't pass `redirect` through

[storefront/account/register/page.tsx:77](storefront/account/register/page.tsx#L77). Always pushes to `/storefront/account`. If user came from checkout, they lose context. Login does honor `redirect`; register doesn't.

### 5.10 [storefront/account/profile/page.tsx](apps/web/src/app/storefront/account/profile/page.tsx)

#### 🟠 SF-PR1 — `acceptsMarketing` undefined → false → silently opts user out

[storefront/account/profile/page.tsx:46](storefront/account/profile/page.tsx#L46). `setAcceptsMarketing(customer.acceptsMarketing)` may be undefined; checkbox renders uncontrolled. "Save Changes" sends `false`, opting out a user who was previously opted in.

#### 🟠 SF-PR2 — Password change has no client-side rule check

[storefront/account/profile/page.tsx:73-96](storefront/account/profile/page.tsx#L73). Lets users submit "12345678" and rely on server. Inconsistent with reset-password page (4 rules).

### 5.11 [storefront/account/addresses/page.tsx](apps/web/src/app/storefront/account/addresses/page.tsx)

#### 🟠 SF-AD1 — Address form has no country selector

[storefront/account/addresses/page.tsx:38](storefront/account/addresses/page.tsx#L38). Defaults to "US" and the form doesn't render a country input. Non-US users stuck with US.

### 5.12 [storefront/account/orders/page.tsx](apps/web/src/app/storefront/account/orders/page.tsx)

#### 🟠 SF-OR1 — Same reorder line-item-id bug as SF-OC4

#### 🟠 SF-OR2 — `ordersApi.list({ limit: 50 })` has no pagination UI

[storefront/account/orders/page.tsx:50](storefront/account/orders/page.tsx#L50). Past order #51 is invisible.

---

## 6. Cross-Cutting Patterns

### 6.1 🔴 Auth fetch plumbing is incoherent

**Three patterns coexist:**

1. **Bare `fetch()` + manual headers** (no refresh on 401) — found in **27 files**. Sample: [app/page.tsx:84](apps/web/src/app/app/page.tsx#L84), [app/products/new/page.tsx:75](apps/web/src/app/app/products/new/page.tsx#L75), [app/settings/payments/page.tsx:30](apps/web/src/app/app/settings/payments/page.tsx#L30), [app/marketplace/page.tsx:35](apps/web/src/app/app/marketplace/page.tsx#L35), [app/operations/notifications/page.tsx:66](apps/web/src/app/app/operations/notifications/page.tsx#L66).
2. **`lib/admin-fetch.ts`** — auto-attaches `Authorization` + `x-tenant-id` but **does not refresh tokens**. Used in marketplace settings and a few other places.
3. **`lib/api.ts` Axios singleton** — full 401-refresh-retry logic. Used by **37 page imports**, often mixed with pattern 1 inside the same file.

Pages using patterns 1 or 2 silently fail on token expiry — the user sees stale data, generic errors, or empty states. Pattern 3 has its own bug (see 6.2).

**Fix:** consolidate every authenticated request on the Axios singleton. Either delete `admin-fetch.ts` or extend it with the refresh logic.

### 6.2 🔴 Axios interceptor redirects to non-existent `/app/login`

[lib/api.ts:78, 89, 156](apps/web/src/lib/api.ts#L78). On token-refresh failure the interceptor sends admins to `/app/login` — **which doesn't exist**. Tenant-admin login is at top-level `/login`. **Every admin user whose refresh token expires lands on a 404** instead of being able to re-login.

**Fix:** change `'/app/login'` → `'/login'` in lib/api.ts.

### 6.3 🟠 Dead routes (404 on real user action)

| Reference | Linked from |
|---|---|
| `/app/settings/account` | Dashboard "Verify your email" checklist [app/page.tsx:251](apps/web/src/app/app/page.tsx#L251) |
| `/forgot-password` | Login [login/page.tsx:90](apps/web/src/app/login/page.tsx#L90), Signup error [signup/page.tsx:480](apps/web/src/app/signup/page.tsx#L480) |
| `/app/login` | Axios interceptor [lib/api.ts:89](apps/web/src/lib/api.ts#L89) |

### 6.4 🟠 `unwrapJson(await res.json())` on HTML 5xx responses

This pattern (`if (!res.ok) { const err = unwrapJson(await res.json()); throw ... }`) crashes when the response is HTML rather than JSON — and it's HTML on every Next.js 5xx default error page, every gateway timeout, every proxy disconnect. The crash class hit during initial Docker startup is the same.

**Affected pages:** at least 30 sites across admin core, marketplace, settings/ops/reports. Sample: ST2, LE3, NO3, AU3, M9, M19, M25, M44, M52, M59 (full list in section findings).

**Fix:** introduce `safeJson(res)` helper:

```ts
async function safeJson(res: Response): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  if (!res.headers.get('content-type')?.includes('json')) {
    return { ok: false, error: `Server error (HTTP ${res.status})` };
  }
  try {
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, error: 'Malformed server response' };
  }
}
```

### 6.5 🟠 Status-value casing inconsistency (listings)

The same listing-status filter param is sent in three different ways across the marketplace:

- Dashboard tile: `?status=ERROR` (UPPERCASE) — [app/page.tsx:205](app/page.tsx#L205)
- List page filter: `published` (lowercase) — [listings/page.tsx:267](listings/page.tsx#L267)
- New-campaign page: `ACTIVE` (UPPERCASE, **different word**) — [campaigns/new/page.tsx:74](campaigns/new/page.tsx#L74)

**Result:** dashboard deep-links don't filter (M17). Campaigns/new shows zero listings (M90).

**Fix:** server-side canonical convention; UI uses one normalized value.

### 6.6 🟠 Pagination `setPage(p+1); loadX()` reads stale page

Repeated bug across three inventory pages — [app/inventory/batches/page.tsx:297](apps/web/src/app/app/inventory/batches/page.tsx#L297), [movements/page.tsx:304](apps/web/src/app/app/inventory/movements/page.tsx#L304), [serials/page.tsx:361](apps/web/src/app/app/inventory/serials/page.tsx#L361). React state updates are async — `loadX()` runs with the *previous* `page`. **Clicking Next loads the same page.**

**Fix:** `useEffect` on `[page]`, or pass new page as arg.

### 6.7 🟠 Error handlers that silently log to console

Pattern `catch (err) { console.error(err) }` with no UI feedback. Found in: [app/products/[id]/variants/page.tsx:55](app/products/[id]/variants/page.tsx#L55) (delete), [orders/[id]/page.tsx:74](app/orders/[id]/page.tsx#L74) (load), [reviews/page.tsx:43](app/reviews/page.tsx#L43) (moderate), [studio/page.tsx:17](app/studio/page.tsx#L17) (init), [audit-logs/page.tsx:67](app/operations/audit-logs/page.tsx#L67) (export), [doctype]/page.tsx:21, [doctype]/[name]/page.tsx:36, plus 5 silently-empty catches in operations/notifications.

User clicks button → sees nothing → can't tell if action succeeded.

**Fix:** every catch fires a `toast({ variant: 'destructive' })` minimum.

### 6.8 🟠 Confirmation pattern inconsistency

Most destructive actions use `<ConfirmDialog>`. Exceptions:

- [app/[doctype]/page.tsx:47](app/[doctype]/page.tsx#L47) — `window.confirm` for bulk delete (DT1)
- [app/marketplace/promotions/page.tsx:175](app/marketplace/promotions/page.tsx#L175) — `window.confirm` for delete (M83)
- [app/marketplace/email-campaigns/page.tsx:225](app/marketplace/email-campaigns/page.tsx#L225) — `window.confirm` (M101)
- [app/marketplace/campaigns/[id]/page.tsx:99-119](app/marketplace/campaigns/[id]/page.tsx#L99) — pause/resume/end with no confirm
- [app/marketplace/campaigns/page.tsx:393](app/marketplace/campaigns/page.tsx#L393) — end with no confirm
- [app/marketplace/orders/page.tsx:209](app/marketplace/orders/page.tsx#L209) — create-NoSlag-order with no confirm
- [app/operations/webhooks/page.tsx:342](app/operations/webhooks/page.tsx#L342) — webhook pause/resume one click
- [storefront/cart/page.tsx:54](storefront/cart/page.tsx#L54) — remove cart item one click

### 6.9 🟠 `window.location.*` SPA escapes

18 sites surveyed. Legitimate uses: OAuth redirects ([connections/page.tsx:110, 171](app/marketplace/connections/page.tsx#L110)), Stripe payment return URL ([stripe-payment.tsx:63](apps/web/src/app/storefront/_components/stripe-payment.tsx#L63)), mailto. Illegitimate uses:

- [app/page.tsx:172, 238](app/page.tsx#L172) — error retry + publish reload
- [app/earnings/page.tsx:110, 123](app/earnings/page.tsx#L110) — login redirect
- [app/settings/payments/page.tsx:126](app/settings/payments/page.tsx#L126) — onboarding navigate
- [storefront/products/page.tsx:408](storefront/products/page.tsx#L408) — error retry

### 6.10 🟠 `tenantId` from localStorage as `x-tenant-id` header

Every admin page sends `x-tenant-id: <localStorage>`. The API's `tenant.middleware.ts` accepts this header **only when `ALLOW_TENANT_HEADER=true`** (dev only); production resolves tenant from Host header / authenticated user. **In production, the localStorage tenant header does nothing.** In dev, a malicious user could spoof tenants by tampering with localStorage.

Architectural; out of scope for individual page fixes but worth flagging.

### 6.11 🟡 Next.js 16 `params` Promise unwrapping

In Next.js 16, `params` is a Promise that must be `await`ed in server components or `use()`-unwrapped in client components. Found accessing `params.id` synchronously in:

- [app/orders/[id]/page.tsx:55](app/orders/[id]/page.tsx#L55) (OD1)
- [app/customers/[id]/page.tsx:62](app/customers/[id]/page.tsx#L62) (CD1)
- [storefront/pages/[slug]/page.tsx:30](storefront/pages/[slug]/page.tsx#L30) (SF-CMS2)

### 6.12 🟡 Forms without `<form>` element / no Enter-to-submit

[app/products/[id]/edit/page.tsx](app/products/[id]/edit/page.tsx#L282), [app/inventory/batches/page.tsx](app/inventory/batches/page.tsx#L316), [app/inventory/movements/page.tsx](app/inventory/movements/page.tsx#L323). `required` constraints never trigger.

### 6.13 🟡 Currency formatting hardcoded to USD

- Dashboard `formatCurrency` reads `tenantCurrency` from localStorage but **nothing sets that key** during onboarding. Effective default: USD.
- Listings/new prices show `$` regardless of marketplace ([new/page.tsx:1518](app/marketplace/listings/new/page.tsx#L1518)).
- Listings/[id] update-offer panel allows mismatched currency.
- Returns/[id] line items show `$` always.
- Inventory page `formatCurrency` hardcoded USD.

### 6.14 🟢 No TODO/FIXME/HACK comments anywhere

Searched `apps/web/src` — zero hits. Small win.

### 6.15 🟢 Decorative buttons with no handler

- [app/setup/page.tsx:66](app/setup/page.tsx#L66) — "View Setup Guide"
- [app/studio/page.tsx:46](app/studio/page.tsx#L46) — "Documentation"
- [storefront/page.tsx:102](storefront/page.tsx#L102) — "Book a design session"
- [storefront/layout.tsx:146](storefront/layout.tsx#L146) — "Sales inquiry"
- [storefront/products/page.tsx:512](storefront/products/page.tsx#L512) — "Talk to sales"

### 6.16 🟢 Landing page

- Structured-data `aggregateRating` is fabricated (4.9 / 500 ratings) at [landing/page.tsx:99-104](apps/web/src/app/landing/page.tsx#L99). Borderline schema fraud per Google's guidelines.
- Hardcoded canonical URLs in metadata (`https://noslag.com/landing`) — fine for noslag.com, but multi-tenant deploys would index incorrectly.

### 6.17 🟢 Preview page hardcoded placeholders

[preview/page.tsx](apps/web/src/app/preview/page.tsx). "Store Name", "Product 1/2/3", `&copy; 2024`. Used as iframe content for theme previews, fine — but the dead `<a href="#">` links scroll the iframe to top instead of doing nothing.

---

## 7. Prioritized Punch List

The order here is **what to fix first if you only have an afternoon, then a week, then a sprint.** Severity 🔴 first, ordered by user-blast-radius.

### Tier 1 — Fix immediately (data-loss / unreachable / corrupt commerce)

| # | ID | What | File |
|---|---|---|---|
| 1 | 6.2 | Axios redirects to non-existent `/app/login` on token expiry | [lib/api.ts:89](apps/web/src/lib/api.ts#L89) |
| 2 | D1 | Dashboard "Verify your email" 404s | [app/page.tsx:251](app/page.tsx#L251) |
| 3 | L1 | Login "Forgot password?" 404s | [login/page.tsx:90](login/page.tsx#L90) |
| 4 | LE2 | Legal page tab switch silently destroys unsaved edits | [app/settings/legal/page.tsx:62](app/settings/legal/page.tsx#L62) |
| 5 | SF-PD1 | Storefront variant selection doesn't reach AddToCart (wrong SKUs ordered) | [storefront/products/[slug]/page.tsx:202](storefront/products/[slug]/page.tsx#L202) |
| 6 | SF-PD2 | Two AddToCart buttons can fire concurrent adds | [storefront/products/[slug]/page.tsx:219](storefront/products/[slug]/page.tsx#L219) |
| 7 | SF-CK1 | Checkout summary doesn't reflect chosen shipping rate price | [storefront/checkout/page.tsx:824](storefront/checkout/page.tsx#L824) |
| 8 | SF-CK2/3/4 | Checkout state-required, country-list, pre-fill clobber issues | [storefront/checkout/page.tsx](storefront/checkout/page.tsx) |
| 9 | SF-OC4 / SF-OR1 | "Reorder" feature broken — adds line-item IDs as product IDs | [storefront/order-confirmation/page.tsx:79](storefront/order-confirmation/page.tsx#L79), [storefront/account/orders/page.tsx:75](storefront/account/orders/page.tsx#L75) |
| 10 | M51 | Marketplace order detail page is unreachable from list (refund/cancel inaccessible) | [app/marketplace/orders/page.tsx](app/marketplace/orders/page.tsx) |
| 11 | M23 / M39 | Schedule body field name mismatch (`scheduledDate` vs `scheduledAt`) | [listings/new/page.tsx:872](listings/new/page.tsx#L872), [listings/[id]/page.tsx:688](listings/[id]/page.tsx#L688) |
| 12 | M40 | Edit listing wipes `platformData` brand/MPN/UPC/EAN/ISBN | [listings/[id]/page.tsx:570](listings/[id]/page.tsx#L570) |
| 13 | M90 | Campaigns/new sends wrong status; selects zero listings | [campaigns/new/page.tsx:74](campaigns/new/page.tsx#L74) |
| 14 | M82 | Promotions page has prominent "Coming soon" CTAs | [promotions/page.tsx:217](promotions/page.tsx#L217) |
| 15 | M123 | Marketplace permissions tab has interactive toggles but no Save | [marketplace/settings/page.tsx:1054](marketplace/settings/page.tsx#L1054) |
| 16 | T1 | Theme preview iframe never reflects the previewed theme | [app/themes/page.tsx:50](app/themes/page.tsx#L50) |
| 17 | PV1 | Bulk variant generation: 125 sequential POSTs, partial-failure leaves orphans | [app/products/[id]/variants/page.tsx:206](app/products/[id]/variants/page.tsx#L206) |
| 18 | OD4 | Order detail `adminNotes` never populated from server; saving overwrites | [app/orders/[id]/page.tsx:59](app/orders/[id]/page.tsx#L59) |
| 19 | DTN1 | DocType form submit/cancel handlers throw unhandled | [app/[doctype]/[name]/page.tsx:61](app/[doctype]/[name]/page.tsx#L61) |
| 20 | M17 | Listings page status filter ignores URL `?status=` from dashboard | [marketplace/listings/page.tsx:267](marketplace/listings/page.tsx#L267) |
| 21 | S1 | Signup "Create Store" silently fails on earlier-step validation error | [signup/page.tsx:497](signup/page.tsx#L497) |
| 22 | C1 | Onboarding-complete double-fires on reload | [onboarding/[tenantId]/complete/page.tsx:16](onboarding/[tenantId]/complete/page.tsx#L16) |
| 23 | S3 | Signup error "reset your password" link 404s | [signup/page.tsx:480](signup/page.tsx#L480) |

### Tier 2 — Fix this sprint (broken UX, hidden errors, silent corruptions)

Tier 2 covers all 🟠 findings. Major themes:

- **6.4** `unwrapJson(await res.json())` HTML-500 crash — fix once with `safeJson()` helper, sweep all 30+ call sites.
- **6.7** Silent `console.error`-only catch handlers — sweep adds toasts to every silent catch (PV2, PV3, R2, S2, AU1, NO1, etc.).
- **6.6** Pagination stale-state bug — three inventory pages.
- **C2 / O1 / O2** Onboarding wizard polishing.
- **PE4 / IB3 / IM3 / IS4** Add `<form>` wrappers + Enter-to-submit + label `htmlFor`.
- **PA1 / PA2 / PA5** Payments page — refactor for refresh-aware fetch and add Square actions.
- **SH2 / SH3 / SH5** Shipping page — surface zone-load failures, "blank means leave alone" semantics, validate zone countries.
- **SE1 / SE2** Setup page — timeout the doctype loads, distinguish "0 records" from "load failed."
- **OD2 / CD3 / E1 / D2 / D3** Dashboard / order / customer / earnings — replace `window.location.*` with proper handlers, make stats correct, surface load failures.
- **WH1 / WH2 / WH5** Webhooks — add validation, confirm dialog on toggle, paginate deliveries.
- **JB1 / JB2** Jobs — fix polling effect deps and 401 hammering.
- **AU1 / AU2** Audit logs — fix export silent-fail and add server-side search/pagination.
- **M8 / M82 / M95 / M97** Marketplace — OAuth half-state UX, add confirms to destructive actions.
- **M26 / M29 / M33 / M40 / M41** Marketplace listings — image upload validation, item-specifics for SELECTION_ONLY, currency by marketplace, edit-mode preserve fields, category dropdown.
- **SF-C1 / SF-C2 / SF-C3** Cart — read tenant rules for free-shipping, optimistic + debounced quantity, confirm on remove.
- **SF-CK5 / SF-CK8 / SF-CK11 / SF-CK12** Checkout — wire AbortController, surface "select shipping method", surface payment-config errors.
- **SF-OC4 / SF-OR1 / SF-OR2** Account orders — fix reorder line-item-id bug, add pagination.
- **R-COMMON-1, -2, -3** Reports — add typeahead for codes, sync filters to URL, surface table-area loading state.

### Tier 3 — Defer or batch (rough/cosmetic)

- All 🟡 findings on item-specifics rendering, chart styling, decimal formatting, missing `aria-busy`, repeated icon imports, hardcoded $ where it doesn't matter.
- A11y nits: missing `htmlFor`, icon-only buttons without `aria-label`.
- Decorative buttons (6.15) — either wire them or remove.
- Landing page schema fraud (6.16).
- Preview page hardcoded `&copy; 2024`.

### Architectural / cross-cutting (not a single fix)

- **6.1** Consolidate fetch patterns. Migrate every page from bare-fetch / admin-fetch to the Axios singleton. ~20-30 page edits, mostly mechanical.
- **6.10** Re-think tenant-header strategy — localStorage-derived `x-tenant-id` is dev-only and the header is ignored in prod. UI should not pretend to send it.
- **6.13** Set `tenantCurrency` in localStorage during onboarding, or read it from a tenant-config endpoint instead.

---

## 8. Methodology Note

This audit was produced by reading every page in `apps/web/src/app/` (98 pages) plus `apps/web/src/lib/`. Findings carry concrete file:line citations so each can be triaged independently. **No code was modified during the audit** — every observation is reproducible from the cited file at HEAD.

Where multi-page bugs share a root cause (the auth fetch patterns, `unwrapJson` HTML-500 crash, `window.location` escapes), the cross-cutting section consolidates them with one fix that resolves all instances. The prioritized punch list reflects that — fixing **6.2** alone resolves admin login expiry across the entire admin shell.
