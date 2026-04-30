'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ListView, DocTypeDefinition, toast } from '@platform/ui';
import { Loader2 } from 'lucide-react';
import api from '../../../lib/api';

export default function DocTypeListPage() {
    const params = useParams();
    const router = useRouter();
    const docTypeName = params.doctype as string;

    const [docType, setDocType] = useState<DocTypeDefinition | null>(null);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [loadError, setLoadError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        try {
            const dataRes = await api.get(`/v1/doc/${docTypeName}`);
            if (Array.isArray(dataRes.data)) setData(dataRes.data);
        } catch (err) {
            console.error(err);
            const msg = err instanceof Error ? err.message : `Could not load ${docTypeName}.`;
            setLoadError(msg);
            toast({ title: 'Could not load records', description: msg, variant: 'destructive' });
        }
    }, [docTypeName]);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            setLoadError(null);
            try {
                const metaRes = await api.get(`/v1/doc/meta/${docTypeName}`);
                if (metaRes.data) setDocType(metaRes.data);
                await loadData();
            } catch (err) {
                console.error(err);
                const msg = err instanceof Error ? err.message : `Could not load ${docTypeName} meta.`;
                setLoadError(msg);
                toast({ title: 'Could not load DocType', description: msg, variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        };
        if (docTypeName) init();
    }, [docTypeName, loadData]);

    const handleRowClick = (row: any) => router.push(`/app/${docTypeName}/${row.name}`);
    const handleCreate = () => router.push(`/app/${docTypeName}/new`);

    const handleBulkDelete = async (rows: any[]) => {
        if (!rows.length) return;
        if (!confirm(`Delete ${rows.length} ${docTypeName} record${rows.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
        const results = await Promise.allSettled(
            rows.map((r) => api.delete(`/v1/doc/${docTypeName}/${encodeURIComponent(r.name)}`))
        );
        const ok = results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.length - ok;
        if (failed === 0) {
            toast({ title: `Deleted ${ok}`, description: `Removed ${ok} record${ok === 1 ? '' : 's'}.`, variant: 'success' });
        } else {
            toast({
                title: 'Partial delete',
                description: `${ok} succeeded, ${failed} failed.`,
                variant: 'destructive',
            });
        }
        await loadData();
    };

    if (loading && !docType) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!docType) {
        // Distinguish real-not-found (404 from API would return null meta)
        // from a transient load failure (network/auth/5xx). The previous
        // bare div misdirected users to "DocType not found" when in fact
        // the meta endpoint had errored. See DT3 in docs/ui-audit.md.
        return (
            <div className="p-8">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
                    <p className="text-sm font-medium text-amber-800">
                        {loadError ? 'Could not load DocType' : `DocType '${docTypeName}' not found`}
                    </p>
                    {loadError && (
                        <p className="mt-1 text-xs text-amber-700">{loadError}</p>
                    )}
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-3 text-sm font-medium text-amber-700 underline hover:no-underline"
                    >
                        Try again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full">
            <ListView
                docType={docType}
                data={data}
                loading={loading}
                onRowClick={handleRowClick}
                onCreateClick={handleCreate}
                onRefresh={loadData}
                onBulkDelete={handleBulkDelete}
            />
        </div>
    );
}
