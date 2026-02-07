// Placeholder for real client
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export const getDocType = async (docType: string) => {
    const res = await fetch(`${API_BASE}/meta/${docType}`);
    if (!res.ok) {
        // Fallback or throw
        console.warn(`Failed to fetch metadata for ${docType}`);
        return null;
    }
    return res.json();
}

export const getDoc = async (docType: string, name: string) => {
    const res = await fetch(`${API_BASE}/${docType}/${name}`);
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
}

export const saveDoc = async (docType: string, data: any) => {
    const isNew = !data.name; 
    const url = isNew ? `${API_BASE}/${docType}` : `${API_BASE}/${docType}/${data.name}`;
    const method = isNew ? 'POST' : 'PUT';

    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Error saving');
    }
    return res.json();
}
