/**
 * Run axe-core against the Wave 1 platform primitives. If the primitives
 * are clean, every page that composes from them inherits that — so this
 * is high leverage.
 */
import '../jest.setup';
import { render } from '@testing-library/react';
import { DataTable, EmptyState, PromptDialog, StatusBadge, type DataTableColumn } from '@platform/ui';
import { axeViolations, formatViolations } from './axe-helper';

interface Row { id: string; name: string }
const COLUMNS: DataTableColumn<Row>[] = [
  { id: 'name', header: 'Name', sortable: true, cell: (r) => r.name },
];
const ROWS: Row[] = [
  { id: 'r1', name: 'Apple' },
  { id: 'r2', name: 'Banana' },
];

describe('a11y · primitives', () => {
  it('StatusBadge renders without violations', async () => {
    const { container } = render(<StatusBadge kind="order" status="DELIVERED" />);
    const v = await axeViolations(container);
    if (v.length) throw new Error(formatViolations(v));
  });

  it('EmptyState renders without violations', async () => {
    const { container } = render(
      <EmptyState
        title="No products yet"
        description="Add your first product to get started."
        primaryAction={<button type="button">Add product</button>}
      />,
    );
    const v = await axeViolations(container);
    if (v.length) throw new Error(formatViolations(v));
  });

  it('DataTable (with selection + sortable header) renders without violations', async () => {
    const { container } = render(
      <DataTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        selectable
        selectedIds={[]}
        onSelectionChange={() => {}}
        sort={{ id: 'name', dir: 'asc' }}
        onSortChange={() => {}}
      />,
    );
    const v = await axeViolations(container);
    if (v.length) throw new Error(formatViolations(v));
  });

  it('PromptDialog with required field renders without violations', async () => {
    const { container } = render(
      <PromptDialog
        open
        onOpenChange={() => {}}
        title="Add carrier"
        description="Enter carrier details."
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
          { name: 'tracking', label: 'Tracking', required: true, helperText: 'Visible to the customer.' },
        ]}
        onSubmit={() => {}}
      />,
    );
    const v = await axeViolations(container);
    if (v.length) throw new Error(formatViolations(v));
  });
});
