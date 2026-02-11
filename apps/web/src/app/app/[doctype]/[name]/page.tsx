'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FormView, DocTypeDefinition, toast } from '@platform/ui';
import { Loader2 } from 'lucide-react';
import api from '../../../../lib/api';

export default function DocTypeFormPage() {
    const params = useParams();
    const router = useRouter();
    const docTypeName = params.doctype as string;
    const docName = decodeURIComponent(params.name as string); // Handle encoded names

    const [docType, setDocType] = useState<DocTypeDefinition | null>(null);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            try {
                // 1. Fetch Meta
                const metaRes = await api.get(`/v1/meta/${docTypeName}`);
                if (metaRes.data) {
                    setDocType(metaRes.data);
                }

                // 2. Fetch Data if not new
                if (docName !== 'new' && docName !== 'New DocType') {
                    const dataRes = await api.get(`/v1/${docTypeName}/${docName}`);
                    setData(dataRes.data);
                } else {
                    setData({});
                }

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (docTypeName) init();
    }, [docTypeName, docName]);

    const handleSave = async (formData: any) => {
        try {
            if (docName === 'new') {
                await api.post(`/v1/${docTypeName}`, formData);
            } else {
                await api.put(`/v1/${docTypeName}/${docName}`, formData);
            }
            router.push(`/app/${docTypeName}`);
        } catch (e) {
            console.error(e);
            toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
            throw e;
        }
    };

    const handleSubmit = async () => {
        await api.put(`/v1/${docTypeName}/${docName}/submit`);
        const dataRes = await api.get(`/v1/${docTypeName}/${docName}`);
        setData(dataRes.data);
    };

    const handleCancel = async () => {
        await api.put(`/v1/${docTypeName}/${docName}/cancel`);
        const dataRes = await api.get(`/v1/${docTypeName}/${docName}`);
        setData(dataRes.data);
    };

    if (loading || !docType) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <FormView 
            docType={docType}
            initialData={data}
            onSave={handleSave}
            onSubmitDoc={docName !== 'new' ? handleSubmit : undefined}
            onCancelDoc={docName !== 'new' ? handleCancel : undefined}
            onNavigateBack={() => router.back()}
        />
    );
}
