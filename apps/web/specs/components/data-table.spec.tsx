import '../jest.setup';
/**
 * Component test: DataTable.
 *
 * The orders/products/customers/users pages all delegate row rendering, sorting,
 * and bulk selection to this primitive. Regressions here cascade.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { DataTable, type DataTableColumn } from '@platform/ui';

interface Row {
  id: string;
  name: string;
  total: number;
}

const ROWS: Row[] = [
  { id: 'r1', name: 'Apple', total: 10 },
  { id: 'r2', name: 'Banana', total: 5 },
  { id: 'r3', name: 'Cherry', total: 2 },
];

const columns: DataTableColumn<Row>[] = [
  { id: 'name', header: 'Name', sortable: true, cell: (r) => r.name },
  { id: 'total', header: 'Total', sortable: true, align: 'right', cell: (r) => r.total },
];

describe('DataTable', () => {
  it('renders headers and rows', () => {
    render(<DataTable columns={columns} rows={ROWS} rowKey={(r) => r.id} />);
    expect(screen.getByRole('button', { name: /name/i })).toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText('Cherry')).toBeInTheDocument();
  });

  it('shows skeletons when loading=true', () => {
    const { container } = render(
      <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} loading />,
    );
    // Skeleton rows render even with empty data
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows empty state when not loading and no rows', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        empty={<div>Nothing here</div>}
      />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('shows the refreshing pip when refreshing=true', () => {
    render(<DataTable columns={columns} rows={ROWS} rowKey={(r) => r.id} refreshing />);
    expect(screen.getByText(/refreshing/i)).toBeInTheDocument();
  });

  it('calls onSortChange when a sortable header is clicked', async () => {
    const onSortChange = jest.fn();
    render(
      <DataTable
        columns={columns}
        rows={ROWS}
        rowKey={(r) => r.id}
        sort={{ id: 'name', dir: null }}
        onSortChange={onSortChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /name/i }));
    expect(onSortChange).toHaveBeenCalledWith({ id: 'name', dir: 'asc' });
  });

  it('cycles asc → desc → null on subsequent sort clicks', async () => {
    const onSortChange = jest.fn();
    const { rerender } = render(
      <DataTable
        columns={columns}
        rows={ROWS}
        rowKey={(r) => r.id}
        sort={{ id: 'name', dir: 'asc' }}
        onSortChange={onSortChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /name/i }));
    expect(onSortChange).toHaveBeenLastCalledWith({ id: 'name', dir: 'desc' });

    rerender(
      <DataTable
        columns={columns}
        rows={ROWS}
        rowKey={(r) => r.id}
        sort={{ id: 'name', dir: 'desc' }}
        onSortChange={onSortChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /name/i }));
    expect(onSortChange).toHaveBeenLastCalledWith({ id: 'name', dir: null });
  });

  it('calls onRowClick with the row when a row is clicked', async () => {
    const onRowClick = jest.fn();
    render(
      <DataTable columns={columns} rows={ROWS} rowKey={(r) => r.id} onRowClick={onRowClick} />,
    );
    fireEvent.click(screen.getByText('Banana'));
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'r2' }));
  });

  describe('selection', () => {
    it('renders row checkboxes when selectable', () => {
      render(
        <DataTable
          columns={columns}
          rows={ROWS}
          rowKey={(r) => r.id}
          selectable
          selectedIds={[]}
          onSelectionChange={() => {}}
        />,
      );
      // 3 rows + 1 header checkbox
      expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    });

    it('select-all toggles all visible rows', async () => {
      const onSelectionChange = jest.fn();
      render(
        <DataTable
          columns={columns}
          rows={ROWS}
          rowKey={(r) => r.id}
          selectable
          selectedIds={[]}
          onSelectionChange={onSelectionChange}
        />,
      );
      fireEvent.click(screen.getByLabelText('Select all rows'));
      expect(onSelectionChange).toHaveBeenCalledWith(['r1', 'r2', 'r3']);
    });

    it('individual checkbox toggles a single row', async () => {
      const onSelectionChange = jest.fn();
      render(
        <DataTable
          columns={columns}
          rows={ROWS}
          rowKey={(r) => r.id}
          selectable
          selectedIds={[]}
          onSelectionChange={onSelectionChange}
        />,
      );
      fireEvent.click(screen.getByLabelText(/select row 2/i));
      expect(onSelectionChange).toHaveBeenCalledWith(['r2']);
    });

    it('shows the bulk action bar with selected count', () => {
      render(
        <DataTable
          columns={columns}
          rows={ROWS}
          rowKey={(r) => r.id}
          selectable
          selectedIds={['r1', 'r2']}
          onSelectionChange={() => {}}
          bulkActions={(ids) => <span>Got {ids.length}</span>}
        />,
      );
      expect(screen.getByText('2 selected')).toBeInTheDocument();
      expect(screen.getByText('Got 2')).toBeInTheDocument();
    });
  });
});
