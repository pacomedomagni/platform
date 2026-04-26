import '../jest.setup';
import { render, waitFor } from '@testing-library/react';
import SignupPage from '../../src/app/signup/page';
import { axeViolations, formatViolations } from './axe-helper';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('a11y · /signup', () => {
  it('passes axe-core WCAG 2.x AA on initial render', async () => {
    const { container } = render(<SignupPage />);
    await waitFor(() => container.querySelector('input'));
    const violations = await axeViolations(container);
    if (violations.length) throw new Error(formatViolations(violations));
  });
});
