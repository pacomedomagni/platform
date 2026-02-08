'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface PageSection {
  id: string;
  type: string;
  config: Record<string, unknown>;
  position: number;
}

const SECTION_TYPES = [
  { value: 'hero', label: 'Hero Banner' },
  { value: 'text', label: 'Text Block' },
  { value: 'image', label: 'Image' },
  { value: 'gallery', label: 'Image Gallery' },
  { value: 'products', label: 'Product Grid' },
  { value: 'features', label: 'Features List' },
  { value: 'testimonials', label: 'Testimonials' },
  { value: 'cta', label: 'Call to Action' },
  { value: 'faq', label: 'FAQ' },
  { value: 'newsletter', label: 'Newsletter Signup' },
  { value: 'banner', label: 'Banner' },
];

export default function PageBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const pageId = params.id as string;

  const [sections, setSections] = useState<PageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<PageSection | null>(null);
  const [configJson, setConfigJson] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(tenantId && { 'x-tenant-id': tenantId }),
  };

  useEffect(() => {
    fetchSections();
  }, [pageId]);

  async function fetchSections() {
    try {
      const res = await fetch(`/api/store/admin/pages/${pageId}/sections`, { headers });
      if (res.ok) {
        setSections(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  async function addSection(type: string) {
    const res = await fetch(`/api/store/admin/pages/${pageId}/sections`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ type, config: {} }),
    });
    if (res.ok) {
      await fetchSections();
    }
  }

  async function updateSection() {
    if (!editingSection) return;
    try {
      const config = JSON.parse(configJson);
      await fetch(`/api/store/admin/pages/${pageId}/sections/${editingSection.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ config }),
      });
      setEditingSection(null);
      await fetchSections();
    } catch {
      alert('Invalid JSON configuration');
    }
  }

  async function deleteSection(sectionId: string) {
    if (!confirm('Delete this section?')) return;
    await fetch(`/api/store/admin/pages/${pageId}/sections/${sectionId}`, {
      method: 'DELETE',
      headers,
    });
    await fetchSections();
  }

  async function moveSection(index: number, direction: 'up' | 'down') {
    const newSections = [...sections];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newSections.length) return;

    const ids = newSections.map((s) => s.id);
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];

    await fetch(`/api/store/admin/pages/${pageId}/sections/reorder`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ sectionIds: ids }),
    });
    await fetchSections();
  }

  if (loading) return <div style={{ padding: 32 }}>Loading...</div>;

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Page Builder</h1>
        <button onClick={() => router.back()} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Back
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 8 }}>Add Section</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SECTION_TYPES.map((st) => (
            <button
              key={st.value}
              onClick={() => addSection(st.value)}
              style={{
                padding: '6px 12px',
                border: '1px solid #ccc',
                borderRadius: 4,
                cursor: 'pointer',
                background: '#f9f9f9',
              }}
            >
              + {st.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: 8 }}>Sections ({sections.length})</h3>
        {sections.length === 0 && <p style={{ color: '#888' }}>No sections yet. Add one above.</p>}
        {sections.map((section, idx) => (
          <div
            key={section.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 16,
              marginBottom: 12,
              background: '#fff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{SECTION_TYPES.find((s) => s.value === section.type)?.label || section.type}</strong>
                <span style={{ color: '#888', marginLeft: 8 }}>Position: {section.position}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button disabled={idx === 0} onClick={() => moveSection(idx, 'up')} style={{ cursor: 'pointer' }}>
                  Up
                </button>
                <button
                  disabled={idx === sections.length - 1}
                  onClick={() => moveSection(idx, 'down')}
                  style={{ cursor: 'pointer' }}
                >
                  Down
                </button>
                <button
                  onClick={() => {
                    setEditingSection(section);
                    setConfigJson(JSON.stringify(section.config, null, 2));
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  Edit
                </button>
                <button onClick={() => deleteSection(section.id)} style={{ color: 'red', cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            </div>

            {editingSection?.id === section.id && (
              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Configuration (JSON)</label>
                <textarea
                  value={configJson}
                  onChange={(e) => setConfigJson(e.target.value)}
                  rows={8}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: 13, padding: 8 }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={updateSection} style={{ padding: '6px 16px', cursor: 'pointer' }}>
                    Save
                  </button>
                  <button onClick={() => setEditingSection(null)} style={{ padding: '6px 16px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
