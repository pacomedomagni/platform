'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FormView, DocTypeDefinition } from '@noslag/ui';
import api from '../../../lib/api';

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
            alert('Failed to save');
            throw e;
        }
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
            onNavigateBack={() => router.back()}
        />
    );
}
