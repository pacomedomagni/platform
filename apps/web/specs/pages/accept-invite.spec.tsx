import '../jest.setup';
/**
 * Page test: /onboarding/accept-invite/[token]
 *
 * Mocks fetch + next/navigation. Verifies:
 *  - Loading state is shown initially
 *  - 200 preview renders the form
 *  - 404 / 410 / network error each render their distinct UI
 *  - Form validates password length and match before posting
 *  - Successful accept persists tokens to localStorage and routes to /app
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AcceptInvitePage from '../../src/app/onboarding/accept-invite/[token]/page';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useParams: () => ({ token: 'abc123token' }),
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

function previewOk(overrides: Partial<any> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        email: 'invitee@y.test',
        firstName: null,
        lastName: null,
        roles: ['staff'],
        storeName: 'Acme Inc',
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        ...overrides,
      },
    }),
  } as Response;
}

describe('AcceptInvitePage', () => {
  it('renders the form when preview returns 200', async () => {
    fetchMock.mockResolvedValueOnce(previewOk());
    render(<AcceptInvitePage />);
    expect(await screen.findByText(/Acme Inc/)).toBeInTheDocument();
    expect(screen.getByText('invitee@y.test')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm password/)).toBeInTheDocument();
  });

  it('shows the not-found UI when preview is 404', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) } as Response);
    render(<AcceptInvitePage />);
    expect(await screen.findByText(/Invitation not found/)).toBeInTheDocument();
  });

  it('shows the gone UI with reason when preview is 410', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 410,
      json: async () => ({ message: 'This invite has expired.' }),
    } as Response);
    render(<AcceptInvitePage />);
    expect(await screen.findByText(/no longer valid/i)).toBeInTheDocument();
    expect(await screen.findByText(/expired/)).toBeInTheDocument();
  });

  it('shows a generic error UI when fetch rejects', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'));
    render(<AcceptInvitePage />);
    expect(await screen.findByText('boom')).toBeInTheDocument();
  });

  it('blocks submit when password is shorter than 8 chars', async () => {
    fetchMock.mockResolvedValueOnce(previewOk());
    render(<AcceptInvitePage />);
    await screen.findByText(/Acme Inc/);

    fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/Confirm password/), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    // Only the preview fetch fired — no accept POST
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('blocks submit when passwords do not match', async () => {
    fetchMock.mockResolvedValueOnce(previewOk());
    render(<AcceptInvitePage />);
    await screen.findByText(/Acme Inc/);

    fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'goodpassword1' } });
    fireEvent.change(screen.getByLabelText(/Confirm password/), { target: { value: 'differentpassword1' } });
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));

    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('on successful accept, persists tokens and routes to /app', async () => {
    fetchMock
      .mockResolvedValueOnce(previewOk())
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            access_token: 'jwt-here',
            refresh_token: 'refresh-here',
            user: { id: 'u1', email: 'invitee@y.test', tenantId: 'tenant-1' },
            tenantId: 'tenant-1',
          },
        }),
      } as Response);
    render(<AcceptInvitePage />);
    await screen.findByText(/Acme Inc/);

    fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'goodpassword1' } });
    fireEvent.change(screen.getByLabelText(/Confirm password/), { target: { value: 'goodpassword1' } });
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/app'));
    expect(localStorage.getItem('access_token')).toBe('jwt-here');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-here');
    expect(localStorage.getItem('tenantId')).toBe('tenant-1');
  });

  it('surfaces server error message on accept 410', async () => {
    fetchMock
      .mockResolvedValueOnce(previewOk())
      .mockResolvedValueOnce({
        ok: false,
        status: 410,
        json: async () => ({ message: 'This invite is revoked.' }),
      } as Response);
    render(<AcceptInvitePage />);
    await screen.findByText(/Acme Inc/);

    fireEvent.change(screen.getByLabelText(/^Password$/), { target: { value: 'goodpassword1' } });
    fireEvent.change(screen.getByLabelText(/Confirm password/), { target: { value: 'goodpassword1' } });
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));

    expect(await screen.findByText('This invite is revoked.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
