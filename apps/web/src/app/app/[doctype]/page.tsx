'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ListView, DocTypeDefinition } from '@platform/ui';
import { Loader2 } from 'lucide-react';
import api from '../../../lib/api';

export default function DocTypeListPage() {
    const params = useParams();
    const router = useRouter();
    const docTypeName = params.doctype as string;

    const [docType, setDocType] = useState<DocTypeDefinition | null>(null);
    const [data, setData] = useState<any[]>([]);
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

                // 2. Fetch Data
                const dataRes = await api.get(`/v1/${docTypeName}`);
                if (Array.isArray(dataRes.data)) {
                    setData(dataRes.data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        if (docTypeName) {
            init();
        }
    }, [docTypeName]);

    const handleRowClick = (row: any) => {
        router.push(`/app/${docTypeName}/${row.name}`);
    };

    const handleCreate = () => {
        router.push(`/app/${docTypeName}/new`);
    }

    if (loading && !docType) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!docType) {
        return <div>DocType not found</div>;
    }

    return (
        <div className="h-full">
            <ListView 
                docType={docType} 
                data={data}
                loading={loading}
                onRowClick={handleRowClick}
                onCreateClick={handleCreate}
            />
        </div>
    );
}
