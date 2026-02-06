'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ListView, DocTypeDefinition } from '@platform/ui';

export default function ListPage({ params }: { params: { doctype: string } }) {
    const router = useRouter();
    const docName = decodeURIComponent(params.doctype);
    const [meta, setMeta] = useState<DocTypeDefinition | null>(null);

    useEffect(() => {
        fetch(`/api/v1/meta/${docName}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                setMeta(data);
            })
            .catch(err => {
                console.error(err);
                // Optionally redirect to 404
            });
    }, [docName]);

    if (!meta) return <div className="p-10 text-center">Loading Metadata...</div>;

    return (
        <ListView 
            docType={meta} 
            onRowClick={(row: { name?: string }) => router.push(`/desk/${docName}/${row.name || 'new'}`)} 
        />
    );
}
