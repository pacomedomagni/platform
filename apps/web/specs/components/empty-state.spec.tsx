import '../jest.setup';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@platform/ui';

describe('EmptyState', () => {
  it('renders title only when no description or actions provided', () => {
    render(<EmptyState title="Nothing here yet" />);
    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
  });

  it('renders description below the title', () => {
    render(<EmptyState title="No orders" description="Customers will appear here once they purchase." />);
    expect(screen.getByText(/Customers will appear here/)).toBeInTheDocument();
  });

  it('renders the primary action node', () => {
    render(
      <EmptyState
        title="No products"
        primaryAction={<button type="button">Create product</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Create product' })).toBeInTheDocument();
  });

  it('renders both primary and secondary actions', () => {
    render(
      <EmptyState
        title="No themes"
        primaryAction={<button type="button">Browse presets</button>}
        secondaryAction={<button type="button">Import theme</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Browse presets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import theme' })).toBeInTheDocument();
  });

  it('renders the icon slot when provided', () => {
    render(<EmptyState title="x" icon={<svg data-testid="empty-icon" />} />);
    expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
  });
});
