'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FormView, DocTypeDefinition } from '@platform/ui';
import { getDoc, saveDoc, getDocType } from '../../../../lib/api';

// We need to fetch the DocType metadata definition to render the form.
// Since we don't have a dedicated metadata endpoint in the controller yet,
// I'll hardcode a fetch helper or we can enhance the controller.
// For the demo, let's assume we can fetch it or pass it.

export default function GenericFormPage() {
    const params = useParams();
    const docType = decodeURIComponent(params.doctype as string);
    const name = params.name ? decodeURIComponent(params.name as string) : null;

    const [meta, setMeta] = useState<DocTypeDefinition | null>(null);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch Meta and Data
        const load = async () => {
             try {
                const fetchedMeta = await getDocType(docType);
                if (fetchedMeta && !fetchedMeta.error) {
                    setMeta(fetchedMeta);
                } else {
                    console.error("Meta not found for", docType);
                    // Fallback to mock not needed if backend works, but keeping for safety if backend is down
                }

                if (name && name !== 'new') {
                     const doc = await getDoc(docType, name);
                     setData(doc);
                }
             } catch (e) {
                 console.error(e);
             }
             
             setLoading(false);
        };
        load();
    }, [docType, name]);

    if (loading) return <div>Loading...</div>;
    if (!meta) return <div>DocType {docType} not found in System</div>;

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <FormView 
                docType={meta} 
                initialData={data} 
                onSave={async (val) => {
                    const res = await saveDoc(docType, val);
                    setData(res);
                    alert('Saved!');
                    // Redirect if new?
                }} 
            />
        </div>
    );
}
