'use client';
import { Studio, DocTypeDefinition, Card, toast } from '@platform/ui';
import { useState, useEffect } from 'react';
import api from '../../../lib/api';

export default function StudioPage() {
    const [docTypes, setDocTypes] = useState<DocTypeDefinition[]>([]);
    const [loading, setLoading] = useState(true);

    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDocTypes = async () => {
            try {
                const res = await api.get('/v1/meta');
                if (Array.isArray(res.data)) {
                    setDocTypes(res.data);
                }
            } catch (err) {
                console.error("Failed to fetch meta", err);
                const msg = err instanceof Error ? err.message : 'Could not load DocTypes.';
                setLoadError(msg);
                toast({
                    title: 'Could not load DocTypes',
                    description: msg,
                    variant: 'destructive',
                });
            } finally {
                setLoading(false);
            }
        };
        fetchDocTypes();
    }, []);

    const handleSave = async (dt: DocTypeDefinition) => {
        try {
            await api.post('/v1/meta', dt);
            // Refresh logic handled by Studio component largely, but we could reload here
        } catch (e) {
            console.error(e);
            toast({ title: 'Error', description: 'Failed to save DocType', variant: 'destructive' });
            throw e; 
        }
    };

    if (loading) return <div className="p-8 text-sm text-slate-500">Loading Schema Engine...</div>;
    if (loadError && docTypes.length === 0) {
        return (
            <div className="p-8">
                <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                    <p className="text-sm font-medium text-red-700">Could not load DocTypes</p>
                    <p className="mt-1 text-xs text-red-600">{loadError}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-3 text-sm font-medium text-red-700 underline hover:no-underline"
                    >
                        Try again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 space-y-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Studio Builder</h1>
                    <p className="text-sm text-slate-500">Design DocTypes, fields, and layouts.</p>
                </div>
            </div>
            <Card className="p-4 md:p-6 bg-white/90 dark:bg-slate-950/80 backdrop-blur">
                <Studio 
                    initialDocTypes={docTypes} 
                    onSaveDocType={handleSave} 
                />
            </Card>
        </div>
    );
}
