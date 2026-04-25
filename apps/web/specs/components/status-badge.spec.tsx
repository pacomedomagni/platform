import '../jest.setup';
/**
 * Component test: StatusBadge.
 *
 * The whole platform routes status display through this single component.
 * If these mappings break, every admin and storefront screen mis-renders status.
 */
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@platform/ui';

describe('StatusBadge', () => {
  it('renders the human label for a known order status', () => {
    render(<StatusBadge kind="order" status="DELIVERED" />);
    expect(screen.getByText('Delivered')).toBeInTheDocument();
  });

  it('falls back to the raw status when the kind has no mapping for it', () => {
    render(<StatusBadge kind="order" status="MARTIAN_OVERRIDE" />);
    expect(screen.getByText('MARTIAN_OVERRIDE')).toBeInTheDocument();
  });

  it('renders an em-dash when status is null/undefined', () => {
    render(<StatusBadge kind="order" status={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('upper-cases the status before lookup so callers can pass either case', () => {
    render(<StatusBadge kind="order" status="delivered" />);
    expect(screen.getByText('Delivered')).toBeInTheDocument();
  });

  it('exposes the explicit label override when provided', () => {
    render(<StatusBadge kind="order" status="DELIVERED" label="Marked done" />);
    expect(screen.getByText('Marked done')).toBeInTheDocument();
  });

  describe('kind="payment"', () => {
    it.each([
      ['PAID', 'Paid'],
      ['CAPTURED', 'Paid'],
      ['REFUNDED', 'Refunded'],
      ['FAILED', 'Failed'],
      ['PENDING', 'Payment Pending'],
    ])('maps %s → %s', (status, label) => {
      render(<StatusBadge kind="payment" status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  describe('kind="customer"', () => {
    it.each([
      ['VERIFIED', 'Verified'],
      ['UNVERIFIED', 'Unverified'],
      ['VIP', 'VIP'],
      ['AT_RISK', 'At Risk'],
    ])('maps %s → %s', (status, label) => {
      render(<StatusBadge kind="customer" status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  describe('kind="listing"', () => {
    it.each([
      ['DRAFT', 'Draft'],
      ['PUBLISHING', 'Publishing'],
      ['PUBLISHED', 'Published'],
      ['ERROR', 'Error'],
    ])('maps %s → %s', (status, label) => {
      render(<StatusBadge kind="listing" status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });
});
