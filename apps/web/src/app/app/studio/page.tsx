'use client';
import { Studio, DocTypeDefinition } from '@noslag/ui';
import { useState, useEffect } from 'react';
import api from '../../../lib/api';

export default function StudioPage() {
    const [docTypes, setDocTypes] = useState<DocTypeDefinition[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDocTypes = async () => {
            try {
                const res = await api.get('/v1/meta');
                if (Array.isArray(res.data)) {
                    setDocTypes(res.data);
                }
            } catch (err) {
                console.error("Failed to fetch meta", err);
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
            alert('Failed to save DocType');
            throw e; 
        }
    };

    if (loading) return <div className="p-8">Loading Schema Engine...</div>;

    return (
        <Studio 
            initialDocTypes={docTypes} 
            onSaveDocType={handleSave} 
        />
    );
}
