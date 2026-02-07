'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface LegalPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
  updatedAt: string;
}

const DEFAULT_TABS = [
  { slug: 'terms-of-service', label: 'Terms of Service' },
  { slug: 'privacy-policy', label: 'Privacy Policy' },
  { slug: 'refund-policy', label: 'Refund Policy' },
];

export default function LegalPagesPage() {
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [activeSlug, setActiveSlug] = useState('terms-of-service');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    const tenantId = localStorage.getItem('tenantId');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId || '',
    };
  }, []);

  const fetchPages = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/store/admin/pages', {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch legal pages');
      const data = await res.json();
      setPages(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  useEffect(() => {
    const page = pages.find((p) => p.slug === activeSlug);
    if (page) {
      setTitle(page.title);
      setContent(page.content);
      setIsPublished(page.isPublished);
    } else {
      const tab = DEFAULT_TABS.find((t) => t.slug === activeSlug);
      setTitle(tab?.label || '');
      setContent('');
      setIsPublished(true);
    }
  }, [activeSlug, pages]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/v1/store/admin/pages/${activeSlug}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ title, content, isPublished }),
      });
      if (!res.ok) throw new Error('Failed to save page');
      setSuccessMessage('Page saved successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
      await fetchPages();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mb-6">
          <Link
            href="/app/settings"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Settings
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Legal Pages</h1>
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <Link
          href="/app/settings"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Settings
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Legal Pages</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your store&apos;s terms of service, privacy policy, and refund policy
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-green-700">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {DEFAULT_TABS.map((tab) => {
          const page = pages.find((p) => p.slug === tab.slug);
          const isActive = activeSlug === tab.slug;
          return (
            <button
              key={tab.slug}
              onClick={() => setActiveSlug(tab.slug)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              {page && (
                <span
                  className={`ml-2 inline-block h-2 w-2 rounded-full ${
                    page.isPublished ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Editor */}
      <form onSubmit={handleSave} className="max-w-4xl">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="space-y-6">
            <div>
              <label htmlFor="pageTitle" className="block text-sm font-medium text-slate-700">
                Page Title
              </label>
              <input
                id="pageTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Page title"
              />
            </div>

            <div>
              <label htmlFor="pageContent" className="block text-sm font-medium text-slate-700">
                Content
              </label>
              <textarea
                id="pageContent"
                rows={18}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                placeholder="Enter your page content (HTML supported)"
              />
              <p className="mt-1.5 text-xs text-slate-400">
                You can use HTML to format your content. This page will be visible on your public storefront.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300" />
              </label>
              <span className="text-sm font-medium text-slate-700">
                {isPublished ? 'Published' : 'Draft'}
              </span>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3 border-t border-slate-100 pt-6">
            <button
              type="submit"
              disabled={saving || !title || !content}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Page'}
            </button>
            <Link
              href="/app/settings"
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
