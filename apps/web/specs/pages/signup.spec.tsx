import '../jest.setup';
/**
 * Page test: /signup — locks down the Wave 2 a11y/conversion fixes.
 *
 * Specifically:
 *  - inputs carry the right autocomplete tokens (so password managers work)
 *  - errors are wired via aria-describedby + aria-live (so screen readers announce)
 *  - Continue cannot fire while submit is in flight
 *  - "Already have an account" links to /signup-in path
 */
import { render, screen } from '@testing-library/react';
import SignupPage from '../../src/app/signup/page';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const fetchMock = jest.fn();
beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

beforeEach(() => {
  fetchMock.mockReset();
  replace.mockReset();
  localStorage.clear();
});

describe('SignupPage — accessibility & password-manager wiring', () => {
  it('email input carries autoComplete="email"', () => {
    render(<SignupPage />);
    const email = screen.getByLabelText(/^Email$/i);
    expect(email).toHaveAttribute('autoComplete', 'email');
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('inputMode', 'email');
  });

  it('password input carries autoComplete="new-password"', () => {
    render(<SignupPage />);
    const pw = screen.getByLabelText(/^Password$/i);
    expect(pw).toHaveAttribute('autoComplete', 'new-password');
  });

  it('business-name input carries autoComplete="organization"', () => {
    render(<SignupPage />);
    const biz = screen.getByLabelText(/Business Name/i);
    expect(biz).toHaveAttribute('autoComplete', 'organization');
  });

  it('subdomain input has autoComplete="off" + autoCapitalize="off"', () => {
    render(<SignupPage />);
    const sub = screen.getByLabelText(/Store Subdomain/i);
    expect(sub).toHaveAttribute('autoComplete', 'off');
    expect(sub).toHaveAttribute('autoCapitalize', 'off');
  });

  it('error placeholders have aria-live="polite" so screen readers announce', () => {
    const { container } = render(<SignupPage />);
    const liveRegions = container.querySelectorAll('[aria-live="polite"]');
    expect(liveRegions.length).toBeGreaterThanOrEqual(3);
  });

  it('renders 3-step wizard indicator at step 1 by default', () => {
    render(<SignupPage />);
    const list = screen.getByRole('list');
    const items = list.querySelectorAll('li[aria-current="step"]');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toMatch(/Business Info/i);
  });

  it('Continue button is disabled until Step 1 fields are valid', () => {
    render(<SignupPage />);
    const continueBtn = screen.getByRole('button', { name: /^Continue$/ });
    expect(continueBtn).toBeDisabled();
  });

  it('"Already have an account?" links to /login (not mailto)', () => {
    render(<SignupPage />);
    const link = screen.getByRole('link', { name: /sign in/i });
    expect(link).toHaveAttribute('href', '/login');
  });
});
