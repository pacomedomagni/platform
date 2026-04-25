'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Card,
  Button,
  DataTable,
  StatusBadge,
  ConfirmDialog,
  PromptDialog,
  EmptyState,
  toast,
  type DataTableColumn,
} from '@platform/ui';
import { Users, Mail, ShieldCheck, ShieldOff, Plus, Search, X, Trash2 } from 'lucide-react';
import api from '../../../lib/api';

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
}

interface RoleDefinition {
  id: string;
  label: string;
  description: string;
  permissions: string[];
}

function UsersInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.get('q') ?? '';
  const role = searchParams.get('role') ?? '';
  const sortId = searchParams.get('sort') ?? 'createdAt';
  const sortDir = (searchParams.get('dir') as 'asc' | 'desc' | null) ?? 'desc';

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchDraft, setSearchDraft] = useState(search);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '') sp.delete(k);
        else sp.set(k, v);
      }
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Debounce search → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchDraft !== search) setParam({ q: searchDraft || null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  useEffect(() => setSearchDraft(search), [search]);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      try {
        const [usersRes, rolesRes] = await Promise.all([
          api.get('/v1/admin/users', { params: { q: search || undefined, role: role || undefined } }),
          roles.length === 0 ? api.get('/v1/admin/users/roles') : Promise.resolve({ data: roles }),
        ]);
        setUsers(usersRes.data?.data ?? []);
        if (rolesRes && Array.isArray(rolesRes.data)) setRoles(rolesRes.data);
      } catch (err: any) {
        if (mode === 'initial') {
          toast({
            title: 'Failed to load users',
            description: err?.response?.data?.message || err?.message || 'Backend endpoint unavailable.',
            variant: 'destructive',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, role, roles]
  );

  useEffect(() => {
    load('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, role]);

  const sortedUsers = useMemo(() => {
    if (!sortDir) return users;
    const sorted = [...users];
    sorted.sort((a, b) => {
      const av = (a as any)[sortId];
      const bv = (b as any)[sortId];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (sortId === 'createdAt') {
        const ad = new Date(av).getTime();
        const bd = new Date(bv).getTime();
        return sortDir === 'asc' ? ad - bd : bd - ad;
      }
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return sorted;
  }, [users, sortId, sortDir]);

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  const fullName = (u: User) =>
    [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email.split('@')[0];

  const handleInvite = async (values: Record<string, string>) => {
    setInviting(true);
    try {
      const body = {
        email: values.email.trim(),
        firstName: values.firstName?.trim() || undefined,
        lastName: values.lastName?.trim() || undefined,
        roles: values.role ? [values.role] : ['staff'],
      };
      await api.post('/v1/admin/users/invite', body);
      toast({ title: 'User invited', description: `${body.email} can now sign in.`, variant: 'success' });
      setInviteOpen(false);
      await load('refresh');
    } catch (err: any) {
      toast({
        title: 'Invite failed',
        description: err?.response?.data?.message || err?.message || 'Could not invite user.',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleEdit = async (values: Record<string, string>) => {
    if (!editingUser) return;
    setEditing(true);
    try {
      await api.patch(`/v1/admin/users/${editingUser.id}`, {
        firstName: values.firstName?.trim() || null,
        lastName: values.lastName?.trim() || null,
        roles: values.role ? [values.role] : undefined,
      });
      toast({ title: 'User updated', variant: 'success' });
      setEditingUser(null);
      await load('refresh');
    } catch (err: any) {
      toast({
        title: 'Update failed',
        description: err?.response?.data?.message || err?.message || 'Could not update.',
        variant: 'destructive',
      });
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      await api.delete(`/v1/admin/users/${deleteUser.id}`);
      toast({ title: 'User removed', variant: 'success' });
      setDeleteUser(null);
      await load('refresh');
    } catch (err: any) {
      toast({
        title: 'Delete failed',
        description: err?.response?.data?.message || err?.message || 'Could not delete user.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const columns: DataTableColumn<User>[] = useMemo(
    () => [
      {
        id: 'name',
        header: 'User',
        sortable: false,
        cell: (u) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 text-xs font-semibold text-white">
              {(fullName(u) || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{fullName(u)}</p>
              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'roles',
        header: 'Roles',
        cell: (u) => (
          <div className="flex flex-wrap gap-1">
            {u.roles.map((r) => {
              const def = roles.find((d) => d.id === r);
              return (
                <span
                  key={r}
                  className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
                  title={def?.description}
                >
                  {def?.label ?? r}
                </span>
              );
            })}
          </div>
        ),
      },
      {
        id: 'emailVerified',
        header: 'Email',
        sortable: true,
        cell: (u) => <StatusBadge kind="customer" status={u.emailVerified ? 'VERIFIED' : 'UNVERIFIED'} />,
      },
      {
        id: 'createdAt',
        header: 'Joined',
        sortable: true,
        cell: (u) => <span className="text-sm text-muted-foreground">{formatDate(u.createdAt)}</span>,
      },
      {
        id: 'actions',
        header: '',
        align: 'right',
        cell: (u) => (
          <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" onClick={() => setEditingUser(u)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeleteUser(u)} title="Remove user">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ),
      },
    ],
    [roles]
  );

  const stats = useMemo(() => {
    const out: Record<string, number> = { total: users.length };
    for (const r of roles) out[r.id] = users.filter((u) => u.roles.includes(r.id)).length;
    out.unverified = users.filter((u) => !u.emailVerified).length;
    return out;
  }, [users, roles]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Users & Permissions</h1>
          <p className="text-sm text-slate-500 mt-1">Invite team members, assign roles, and review access.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Invite user
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Total users</p>
          <p className="mt-1 text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Owners</p>
          <p className="mt-1 text-2xl font-bold">{stats.owner ?? 0}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Admins</p>
          <p className="mt-1 text-2xl font-bold">{stats.admin ?? 0}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Unverified</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{stats.unverified}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="relative md:col-span-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search by name or email…"
              aria-label="Search users"
              className="w-full rounded-lg border border-input/80 bg-background/80 pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
          <select
            value={role}
            onChange={(e) => setParam({ role: e.target.value || null })}
            aria-label="Filter by role"
            className="md:col-span-3 rounded-lg border border-input/80 bg-background/80 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="">All roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          {(search || role) && (
            <button
              onClick={() => setParam({ q: null, role: null })}
              className="md:col-span-3 inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>
      </Card>

      <DataTable
        columns={columns}
        rows={sortedUsers}
        rowKey={(u) => u.id}
        loading={loading}
        refreshing={refreshing}
        empty={
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={search || role ? 'No users match these filters' : 'No team members yet'}
            description={
              search || role
                ? 'Try changing your search or role filter.'
                : 'Invite teammates to collaborate on your store.'
            }
            primaryAction={
              <Button onClick={() => setInviteOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Invite user
              </Button>
            }
          />
        }
        sort={{ id: sortId, dir: sortDir }}
        onSortChange={(next) => setParam({ sort: next.dir ? next.id : null, dir: next.dir })}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {/* Permission matrix preview */}
      {roles.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Role permissions</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {roles.map((r) => (
              <div key={r.id} className="rounded-xl border border-border/70 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  <h3 className="font-semibold">{r.label}</h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.permissions.map((p) => (
                    <code key={p} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {p}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Invite dialog */}
      <PromptDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title="Invite a user"
        description="They'll be able to sign in immediately. Email verification is required for some actions."
        confirmLabel={inviting ? 'Inviting…' : 'Send invite'}
        loading={inviting}
        onSubmit={handleInvite}
        fields={[
          { name: 'email', label: 'Email', type: 'text', required: true, placeholder: 'teammate@company.com' },
          { name: 'firstName', label: 'First name', type: 'text', placeholder: 'Optional' },
          { name: 'lastName', label: 'Last name', type: 'text', placeholder: 'Optional' },
          {
            name: 'role',
            label: 'Role',
            type: 'select',
            required: true,
            defaultValue: 'staff',
            options: roles.map((r) => ({ value: r.id, label: r.label })),
          },
        ]}
      />

      {/* Edit dialog */}
      {editingUser && (
        <PromptDialog
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          title={`Edit ${fullName(editingUser)}`}
          description={editingUser.email}
          confirmLabel={editing ? 'Saving…' : 'Save changes'}
          loading={editing}
          onSubmit={handleEdit}
          fields={[
            { name: 'firstName', label: 'First name', defaultValue: editingUser.firstName || '' },
            { name: 'lastName', label: 'Last name', defaultValue: editingUser.lastName || '' },
            {
              name: 'role',
              label: 'Role',
              type: 'select',
              required: true,
              defaultValue: editingUser.roles[0] || 'user',
              options: roles.map((r) => ({ value: r.id, label: r.label })),
            },
          ]}
        />
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteUser}
        onOpenChange={(open) => !open && setDeleteUser(null)}
        title={`Remove ${deleteUser ? fullName(deleteUser) : 'user'}`}
        description={`This will revoke ${deleteUser?.email ?? 'this user'}'s access. They will no longer be able to sign in. This cannot be undone.`}
        confirmLabel={deleting ? 'Removing…' : 'Remove user'}
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        </div>
      }
    >
      <UsersInner />
    </Suspense>
  );
}
