import '../jest.setup';
import { fireEvent, render, screen } from '@testing-library/react';
import { PromptDialog } from '@platform/ui';

describe('PromptDialog', () => {
  function setup(props: Partial<React.ComponentProps<typeof PromptDialog>> = {}) {
    const onSubmit = jest.fn();
    const onOpenChange = jest.fn();
    render(
      <PromptDialog
        open
        onOpenChange={onOpenChange}
        title="Mark as Shipped"
        description="Provide carrier and tracking number."
        fields={[
          {
            name: 'carrier',
            label: 'Carrier',
            type: 'select',
            required: true,
            options: [
              { value: 'USPS', label: 'USPS' },
              { value: 'UPS', label: 'UPS' },
            ],
          },
          {
            name: 'trackingNumber',
            label: 'Tracking Number',
            required: true,
            placeholder: 'e.g. 1Z999AA10123456784',
          },
        ]}
        confirmLabel="Mark as Shipped"
        onSubmit={onSubmit}
        {...props}
      />,
    );
    return { onSubmit, onOpenChange };
  }

  it('renders title, description, and fields', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Mark as Shipped' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Carrier/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tracking Number/)).toBeInTheDocument();
  });

  it('blocks submit and shows per-field error when required field is empty', async () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole('button', { name: /mark as shipped/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Carrier is required/)).toBeInTheDocument();
    expect(screen.getByText(/Tracking Number is required/)).toBeInTheDocument();
  });

  it('submits the collected values when all required fields filled', async () => {
    const { onSubmit } = setup();
    fireEvent.change(screen.getByLabelText(/Carrier/), { target: { value: 'UPS' } });
    fireEvent.change(screen.getByLabelText(/Tracking Number/), { target: { value: '1Z999AA' } });
    fireEvent.click(screen.getByRole('button', { name: /mark as shipped/i }));
    expect(onSubmit).toHaveBeenCalledWith({ carrier: 'UPS', trackingNumber: '1Z999AA' });
  });

  it('cancel button calls onOpenChange(false)', async () => {
    const { onOpenChange, onSubmit } = setup();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables both buttons while loading', () => {
    setup({ loading: true });
    expect(screen.getByRole('button', { name: /mark as shipped/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('respects field defaultValue', () => {
    render(
      <PromptDialog
        open
        onOpenChange={() => {}}
        title="Edit"
        fields={[{ name: 'name', label: 'Name', defaultValue: 'preset' }]}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByLabelText('Name')).toHaveValue('preset');
  });

  it('renders helperText when no error is shown', () => {
    render(
      <PromptDialog
        open
        onOpenChange={() => {}}
        title="Edit"
        fields={[{ name: 'x', label: 'X', helperText: 'Helpful info here' }]}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByText('Helpful info here')).toBeInTheDocument();
  });
});
