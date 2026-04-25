/**
 * Minimal in-house matchers that mirror the @testing-library/jest-dom API
 * we actually use. We avoid adding the dependency to keep the install
 * footprint small; if/when more matchers are needed it's worth pulling
 * jest-dom in instead of growing this file further.
 */

interface CustomMatchers<R = unknown> {
  toBeInTheDocument(): R;
  toHaveAttribute(name: string, value?: string): R;
  toHaveValue(value: string | number | string[]): R;
  toBeDisabled(): R;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> extends CustomMatchers<R> {}
  }
}

function isAttached(node: any): boolean {
  if (!node) return false;
  if (typeof document === 'undefined') return true;
  return document.body.contains(node);
}

expect.extend({
  toBeInTheDocument(received: Element | null) {
    const pass = !!received && isAttached(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected element NOT to be in the document`
          : `expected element to be in the document but it was ${received ? 'detached' : 'null'}`,
    };
  },

  toHaveAttribute(received: Element | null, name: string, value?: string) {
    if (!received) {
      return { pass: false, message: () => `expected non-null element to have attribute "${name}"` };
    }
    const has = received.hasAttribute(name);
    if (!has) {
      return { pass: false, message: () => `expected element to have attribute "${name}"` };
    }
    if (value === undefined) {
      return { pass: true, message: () => `expected element NOT to have attribute "${name}"` };
    }
    const actual = received.getAttribute(name);
    const pass = actual === value;
    return {
      pass,
      message: () =>
        pass
          ? `expected attribute "${name}" NOT to equal "${value}"`
          : `expected attribute "${name}" to equal "${value}", got "${actual}"`,
    };
  },

  toHaveValue(received: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null, value: string | number | string[]) {
    if (!received) {
      return { pass: false, message: () => `expected element to have value "${value}"` };
    }
    const actual = (received as any).value;
    const pass = Array.isArray(value)
      ? Array.isArray(actual) && value.every((v, i) => actual[i] === v)
      : String(actual) === String(value);
    return {
      pass,
      message: () =>
        pass
          ? `expected value NOT to equal "${value}"`
          : `expected value to equal "${value}", got "${actual}"`,
    };
  },

  toBeDisabled(received: HTMLButtonElement | HTMLInputElement | null) {
    if (!received) {
      return { pass: false, message: () => `expected element to be disabled` };
    }
    const pass = received.hasAttribute('disabled') || (received as any).disabled === true;
    return {
      pass,
      message: () => (pass ? `expected element NOT to be disabled` : `expected element to be disabled`),
    };
  },
});

// Some libraries (notably Radix portals) need scrollIntoView in jsdom.
if (typeof window !== 'undefined') {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  if (!(window as any).matchMedia) {
    (window as any).matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
  // Radix Toast uses ResizeObserver
  if (!(window as any).ResizeObserver) {
    (window as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}

export {};
