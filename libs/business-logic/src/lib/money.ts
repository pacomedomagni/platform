import { Prisma } from '@prisma/client';

/**
 * Phase 2 W2.2 — money helpers.
 *
 * The platform stores all monetary fields as `Prisma.Decimal`. Earlier code
 * coerces them to `Number` for arithmetic, which introduces floating-point
 * drift in tax + discount + shipping aggregations and at the Stripe-cents
 * boundary. These helpers make the right operations easy:
 *
 *   - `dec(x)`             coerce any Decimal-like value to Prisma.Decimal
 *   - `add` / `sub`        arithmetic without coercion
 *   - `cents(value)`       convert dollars Decimal to integer cents (Stripe)
 *   - `serialize(value)`   convert Decimal to a number for JSON responses,
 *                          guaranteed to be safe up to 2^53 cents
 *   - `isPositive` / `isZero`
 */

export type DecimalLike =
  | Prisma.Decimal
  | string
  | number
  | { toString(): string };

export function dec(value: DecimalLike | null | undefined): Prisma.Decimal {
  if (value == null) return new Prisma.Decimal(0);
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value as never);
}

export function add(...values: DecimalLike[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (acc, v) => acc.add(dec(v)),
    new Prisma.Decimal(0),
  );
}

export function sub(a: DecimalLike, b: DecimalLike): Prisma.Decimal {
  return dec(a).sub(dec(b));
}

export function mul(a: DecimalLike, b: DecimalLike): Prisma.Decimal {
  return dec(a).mul(dec(b));
}

export function isPositive(value: DecimalLike): boolean {
  return dec(value).greaterThan(0);
}

export function isZero(value: DecimalLike): boolean {
  return dec(value).equals(0);
}

/**
 * Convert a dollars-and-cents Decimal to integer cents. Throws if the value
 * has more than 2 fractional digits — Stripe rejects those, and silent
 * truncation has been an audit finding.
 */
export function toCents(value: DecimalLike): number {
  const d = dec(value);
  const cents = d.mul(100);
  if (!cents.equals(cents.round())) {
    throw new Error(`toCents: ${d.toString()} has sub-cent precision`);
  }
  const n = cents.toNumber();
  if (!Number.isSafeInteger(n)) {
    throw new Error(`toCents: ${d.toString()} overflows safe-integer cents`);
  }
  return n;
}

/**
 * Convert a Decimal to a JSON-safe number for HTTP responses. Guaranteed
 * round-trip via Number for values up to ~$90 trillion (2^53 cents). For
 * larger values use `.toString()` directly.
 */
export function serialize(value: DecimalLike | null | undefined): number {
  if (value == null) return 0;
  const d = dec(value);
  const n = d.toNumber();
  if (!Number.isFinite(n)) {
    throw new Error(`serialize: ${d.toString()} is not a finite Number`);
  }
  return n;
}
