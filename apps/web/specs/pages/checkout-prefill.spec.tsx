import '../jest.setup';
/**
 * Page test: /storefront/checkout — locks down the cart→checkout shipping
 * pre-fill behavior. The checkout form should hydrate country/state/postal
 * from the cart store's `shippingEstimate` (set on the cart page) so users
 * don't have to re-enter the same details twice.
 *
 * Verifies:
 *  - country/state/postal pre-fill from shippingEstimate when blank
 *  - the previously selected rate id wins the auto-select once rates load
 *  - estimate does NOT clobber an authenticated customer's address
 */
import { render, screen, waitFor } from '@testing-library/react';
import CheckoutPage from '../../src/app/storefront/checkout/page';

const push = jest.fn();
const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
}));

// stable mock module surface so the page component can pull state without
// fighting jest.mock hoisting
const mockStore: any = {
  items: [
    { id: 'i1', productId: 'p1', slug: 'a', name: 'A', price: 25, image: '', quantity: 2 },
  ],
  itemCount: 2,
  subtotal: 50,
  shipping: 0,
  tax: 0,
  discount: 0,
  total: 50,
  cartId: 'cart-1',
  shippingEstimate: null as null | Record<string, unknown>,
  clearCart: jest.fn(),
  initializeCart: jest.fn(),
};
const mockAuth: any = { customer: null, isAuthenticated: false };

jest.mock('@/lib/cart-store', () => ({
  useCartStore: () => mockStore,
}));
jest.mock('@/lib/auth-store', () => ({
  useAuthStore: () => mockAuth,
}));

// API surface
const ratesMock = jest.fn();
jest.mock('@/lib/store-api', () => ({
  checkoutApi: { create: jest.fn() },
  paymentsApi: {
    getConfig: jest.fn().mockResolvedValue({ paymentProvider: 'stripe', publicKey: 'pk_test' }),
  },
  shippingApi: {
    getRates: (...args: unknown[]) => ratesMock(...args),
  },
  giftCardApi: { checkBalance: jest.fn() },
}));

beforeEach(() => {
  ratesMock.mockReset();
  mockStore.shippingEstimate = null;
  mockAuth.customer = null;
  mockAuth.isAuthenticated = false;
});

describe('CheckoutPage — cart→checkout shipping pre-fill', () => {
  it('hydrates country/state/postal from shippingEstimate on mount', async () => {
    mockStore.shippingEstimate = {
      country: 'CA',
      state: 'ON',
      postalCode: 'M5V2T6',
      rateId: 'rate-express',
      rateName: 'Express',
      ratePrice: 12,
    };
    ratesMock.mockResolvedValue({
      rates: [
        { id: 'rate-standard', name: 'Standard', price: 5, isFree: false, estimatedDays: '5-7 days' },
        { id: 'rate-express', name: 'Express', price: 12, isFree: false, estimatedDays: '2-3 days' },
      ],
    });

    render(<CheckoutPage />);

    const country = await screen.findByLabelText(/^Country/i) as HTMLSelectElement;
    await waitFor(() => expect(country.value).toBe('CA'));

    const state = screen.getByLabelText(/^State/i) as HTMLInputElement;
    expect(state.value).toBe('ON');

    const postal = screen.getByLabelText(/^Postal code/i) as HTMLInputElement;
    expect(postal.value).toBe('M5V2T6');
  });

  it('auto-selects the previously-chosen rate id once rates load', async () => {
    mockStore.shippingEstimate = {
      country: 'US',
      state: 'CA',
      postalCode: '94110',
      rateId: 'rate-express',
      rateName: 'Express',
      ratePrice: 12,
    };
    ratesMock.mockResolvedValue({
      rates: [
        { id: 'rate-standard', name: 'Standard', price: 5, isFree: false, estimatedDays: '5-7 days' },
        { id: 'rate-express', name: 'Express', price: 12, isFree: false, estimatedDays: '2-3 days' },
      ],
    });

    render(<CheckoutPage />);

    const expressRadio = await screen.findByRole('radio', { name: /Express/i }) as HTMLInputElement;
    const standardRadio = await screen.findByRole('radio', { name: /Standard/i }) as HTMLInputElement;
    await waitFor(() => expect(expressRadio.checked).toBe(true));
    expect(standardRadio.checked).toBe(false);
  });

  it('falls back to the first rate when the saved rate id is no longer available', async () => {
    mockStore.shippingEstimate = {
      country: 'US',
      state: 'CA',
      postalCode: '94110',
      rateId: 'rate-disappeared',
      rateName: 'Express',
      ratePrice: 12,
    };
    ratesMock.mockResolvedValue({
      rates: [
        { id: 'rate-standard', name: 'Standard', price: 5, isFree: false, estimatedDays: '5-7 days' },
      ],
    });

    render(<CheckoutPage />);
    const standard = await screen.findByRole('radio', { name: /Standard/i }) as HTMLInputElement;
    await waitFor(() => expect(standard.checked).toBe(true));
  });

  it('does not clobber an authenticated customer address with the cart estimate', async () => {
    mockAuth.isAuthenticated = true;
    mockAuth.customer = {
      email: 'a@b.test',
      firstName: 'A',
      lastName: 'B',
      phone: null,
      addresses: [
        {
          isDefault: true,
          addressLine1: '1 Customer St',
          city: 'NYC',
          state: 'NY',
          postalCode: '10001',
          country: 'US',
        },
      ],
    };
    mockStore.shippingEstimate = {
      country: 'CA',
      state: 'ON',
      postalCode: 'M5V2T6',
      rateId: 'rate-1',
      rateName: 'X',
      ratePrice: 1,
    };
    ratesMock.mockResolvedValue({ rates: [] });

    render(<CheckoutPage />);
    const country = await screen.findByLabelText(/^Country/i) as HTMLSelectElement;
    await waitFor(() => expect(country.value).toBe('US'));
  });
});
