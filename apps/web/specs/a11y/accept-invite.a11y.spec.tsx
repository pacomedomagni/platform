import '../jest.setup';
import { render, screen } from '@testing-library/react';
import AcceptInvitePage from '../../src/app/onboarding/accept-invite/[token]/page';
import { axeViolations, formatViolations } from './axe-helper';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
  useParams: () => ({ token: 'token-axe' }),
}));

const fetchMock = jest.fn();
beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});
beforeEach(() => fetchMock.mockReset());

describe('a11y · /onboarding/accept-invite/[token]', () => {
  it('passes axe on the form (200 preview)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          email: 'invitee@y.test',
          firstName: null,
          lastName: null,
          roles: ['staff'],
          storeName: 'Acme',
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
      }),
    } as Response);

    const { container } = render(<AcceptInvitePage />);
    await screen.findByText(/Acme/);
    const violations = await axeViolations(container);
    if (violations.length) throw new Error(formatViolations(violations));
  });

  it('passes axe on the gone state (410)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 410,
      json: async () => ({ message: 'This invite has expired.' }),
    } as Response);

    const { container } = render(<AcceptInvitePage />);
    await screen.findByText(/no longer valid/i);
    const violations = await axeViolations(container);
    if (violations.length) throw new Error(formatViolations(violations));
  });
});
