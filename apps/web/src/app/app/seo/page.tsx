'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '../../../lib/api';

interface AuditResult {
  score: number;
  totalProducts: number;
  productsWithMeta: number;
  missingTitle: { id: string; name: string }[];
  missingDescription: { id: string; name: string }[];
  pagesWithoutMeta: { id: string; title: string }[];
}

interface ProductSeo {
  id: string;
  name: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
}

interface PageSeo {
  id: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  slug: string;
}

function CharCount({ current, min, max }: { current: number; min: number; max: number }) {
  const color = current === 0 ? 'text-slate-400' : current >= min && current <= max ? 'text-green-600' : 'text-amber-600';
  return (
    <span className={`text-xs ${color}`}>
      {current}/{max} chars {current >= min && current <= max ? '(good)' : current > max ? '(too long)' : current > 0 ? '(too short)' : ''}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = score >= 80 ? 'text-green-700' : score >= 50 ? 'text-amber-700' : 'text-red-700';
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between">
        <span className="text-sm font-medium text-slate-600">SEO Score</span>
        <span className={`text-3xl font-bold ${textColor}`}>{score}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-3">
        <div className={`${color} h-3 rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
      <p className="text-xs text-slate-500">
        {score >= 80 ? 'Great! Most products have SEO metadata.' : score >= 50 ? 'Decent coverage. Fill in missing metadata to improve.' : 'Many products are missing SEO metadata. This hurts search rankings.'}
      </p>
    </div>
  );
}

function GooglePreview({ title, description, slug }: { title: string; description: string; slug: string }) {
  const displayTitle = title || 'Page Title';
  const displayDesc = description || 'No description provided. Search engines will auto-generate a snippet.';
  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      <p className="text-xs text-slate-400 mb-2 font-medium">Google Search Preview</p>
      <div className="space-y-1">
        <p className="text-sm text-green-700 truncate">yourstore.com/products/{slug || 'product-slug'}</p>
        <p className="text-lg text-blue-800 hover:underline cursor-pointer leading-tight truncate">{displayTitle}</p>
        <p className="text-sm text-slate-600 line-clamp-2">{displayDesc}</p>
      </div>
    </div>
  );
}

export default function SeoPage() {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Product SEO editor
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSeo[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductSeo | null>(null);
  const [productMetaTitle, setProductMetaTitle] = useState('');
  const [productMetaDesc, setProductMetaDesc] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [productSaved, setProductSaved] = useState(false);

  // Page SEO editor
  const [pages, setPages] = useState<PageSeo[]>([]);
  const [selectedPage, setSelectedPage] = useState<PageSeo | null>(null);
  const [pageMetaTitle, setPageMetaTitle] = useState('');
  const [pageMetaDesc, setPageMetaDesc] = useState('');
  const [pageOgImage, setPageOgImage] = useState('');
  const [savingPage, setSavingPage] = useState(false);
  const [pageSaved, setPageSaved] = useState(false);

  // Sitemap
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [generatingSitemap, setGeneratingSitemap] = useState(false);

  // Inline fix mode
  const [fixingItem, setFixingItem] = useState<{ id: string; type: 'product-title' | 'product-desc' | 'page'; name: string } | null>(null);
  const [fixTitle, setFixTitle] = useState('');
  const [fixDesc, setFixDesc] = useState('');
  const [savingFix, setSavingFix] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'products' | 'pages'>('products');

  const loadAudit = useCallback(async () => {
    try {
      setError('');
      const res = await api.get('/v1/store/admin/seo/audit');
      setAudit(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load SEO audit');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  // Product search with debounce
  useEffect(() => {
    if (!productSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/v1/store/admin/seo/audit', { params: { search: productSearch } });
        const products = res.data.products || res.data.missingTitle?.concat(res.data.missingDescription) || [];
        const uniqueProducts = Array.from(new Map(products.map((p: ProductSeo) => [p.id, p])).values()) as ProductSeo[];
        setSearchResults(uniqueProducts.slice(0, 10));
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const selectProduct = (p: ProductSeo | { id: string; name: string }) => {
    const product = p as ProductSeo;
    setSelectedProduct(product);
    setProductMetaTitle(product.metaTitle || '');
    setProductMetaDesc(product.metaDescription || '');
    setProductSearch('');
    setSearchResults([]);
    setProductSaved(false);
  };

  const saveProductSeo = async () => {
    if (!selectedProduct) return;
    setSavingProduct(true);
    setProductSaved(false);
    try {
      await api.put(`/v1/store/admin/seo/products/${selectedProduct.id}`, {
        metaTitle: productMetaTitle,
        metaDescription: productMetaDesc,
      });
      setProductSaved(true);
      loadAudit();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save product SEO');
    } finally {
      setSavingProduct(false);
    }
  };

  const selectPage = (p: PageSeo | { id: string; title: string }) => {
    const page = p as PageSeo;
    setSelectedPage(page);
    setPageMetaTitle(page.metaTitle || '');
    setPageMetaDesc(page.metaDescription || '');
    setPageOgImage(page.ogImage || '');
    setPageSaved(false);
  };

  const savePageSeo = async () => {
    if (!selectedPage) return;
    setSavingPage(true);
    setPageSaved(false);
    try {
      await api.put(`/v1/store/admin/seo/pages/${selectedPage.id}`, {
        metaTitle: pageMetaTitle,
        metaDescription: pageMetaDesc,
        ogImage: pageOgImage,
      });
      setPageSaved(true);
      loadAudit();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save page SEO');
    } finally {
      setSavingPage(false);
    }
  };

  const handleGenerateSitemap = async () => {
    setGeneratingSitemap(true);
    try {
      const res = await api.get('/v1/store/admin/seo/sitemap.xml');
      setSitemapUrl(res.data.url || res.request?.responseURL || '/sitemap.xml');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate sitemap');
    } finally {
      setGeneratingSitemap(false);
    }
  };

  const handleQuickFix = async () => {
    if (!fixingItem) return;
    setSavingFix(true);
    try {
      if (fixingItem.type === 'product-title' || fixingItem.type === 'product-desc') {
        await api.put(`/v1/store/admin/seo/products/${fixingItem.id}`, {
          metaTitle: fixTitle,
          metaDescription: fixDesc,
        });
      } else {
        await api.put(`/v1/store/admin/seo/pages/${fixingItem.id}`, {
          metaTitle: fixTitle,
          metaDescription: fixDesc,
        });
      }
      setFixingItem(null);
      setFixTitle('');
      setFixDesc('');
      loadAudit();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save fix');
    } finally {
      setSavingFix(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="h-20 bg-slate-200 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 rounded-lg" />)}
          </div>
          <div className="h-64 bg-slate-200 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">SEO Management</h1>
        <p className="text-sm text-slate-500 mt-1">Optimize your store for search engines</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}

      {/* SEO Score */}
      {audit && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <ScoreBar score={audit.score} />
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-50 rounded-lg p-3">
              <span className="text-slate-500">Products with meta:</span>
              <span className="font-semibold text-slate-900 ml-2">{audit.productsWithMeta} / {audit.totalProducts}</span>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <span className="text-slate-500">Issues found:</span>
              <span className="font-semibold text-red-600 ml-2">
                {audit.missingTitle.length + audit.missingDescription.length + audit.pagesWithoutMeta.length}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Audit Results */}
      {audit && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Missing Title</h3>
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">{audit.missingTitle.length}</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {audit.missingTitle.length === 0 ? (
                <p className="text-xs text-green-600">All products have meta titles</p>
              ) : (
                audit.missingTitle.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-700 truncate">{item.name}</span>
                    <button
                      onClick={() => { setFixingItem({ id: item.id, type: 'product-title', name: item.name }); setFixTitle(''); setFixDesc(''); }}
                      className="shrink-0 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium hover:bg-indigo-100"
                    >
                      Fix
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Missing Description</h3>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">{audit.missingDescription.length}</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {audit.missingDescription.length === 0 ? (
                <p className="text-xs text-green-600">All products have meta descriptions</p>
              ) : (
                audit.missingDescription.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-700 truncate">{item.name}</span>
                    <button
                      onClick={() => { setFixingItem({ id: item.id, type: 'product-desc', name: item.name }); setFixTitle(''); setFixDesc(''); }}
                      className="shrink-0 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium hover:bg-indigo-100"
                    >
                      Fix
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Pages Without Meta</h3>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">{audit.pagesWithoutMeta.length}</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {audit.pagesWithoutMeta.length === 0 ? (
                <p className="text-xs text-green-600">All pages have meta tags</p>
              ) : (
                audit.pagesWithoutMeta.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-700 truncate">{item.title}</span>
                    <button
                      onClick={() => { setFixingItem({ id: item.id, type: 'page', name: item.title }); setFixTitle(''); setFixDesc(''); }}
                      className="shrink-0 px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium hover:bg-indigo-100"
                    >
                      Fix
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inline Fix Modal */}
      {fixingItem && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-indigo-900">Quick Fix: {fixingItem.name}</h3>
            <button onClick={() => setFixingItem(null)} className="text-indigo-400 hover:text-indigo-600">&times;</button>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium text-slate-700">Meta Title</label>
                <CharCount current={fixTitle.length} min={50} max={60} />
              </div>
              <input
                type="text"
                value={fixTitle}
                onChange={e => setFixTitle(e.target.value)}
                placeholder="Enter a compelling page title (50-60 chars)"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium text-slate-700">Meta Description</label>
                <CharCount current={fixDesc.length} min={150} max={160} />
              </div>
              <textarea
                value={fixDesc}
                onChange={e => setFixDesc(e.target.value)}
                rows={2}
                placeholder="Describe this page for search results (150-160 chars)"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setFixingItem(null)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">Cancel</button>
              <button
                onClick={handleQuickFix}
                disabled={savingFix || (!fixTitle && !fixDesc)}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingFix ? 'Saving...' : 'Save Fix'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('products')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'products' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Product SEO Editor
          </button>
          <button
            onClick={() => setActiveTab('pages')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pages' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Page SEO Editor
          </button>
        </div>
      </div>

      {/* Product SEO Editor */}
      {activeTab === 'products' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
          <h2 className="text-lg font-semibold text-slate-900">Product SEO Editor</h2>

          <div className="relative">
            <input
              type="text"
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="Search for a product..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg mt-1 shadow-lg z-10 max-h-48 overflow-y-auto">
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 border-b border-slate-100 last:border-b-0"
                  >
                    <span className="font-medium text-slate-900">{p.name}</span>
                    {!p.metaTitle && <span className="ml-2 text-xs text-red-500">missing title</span>}
                    {!p.metaDescription && <span className="ml-2 text-xs text-amber-500">missing desc</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedProduct ? (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-900">{selectedProduct.name}</p>
                <p className="text-xs text-slate-500">Slug: {selectedProduct.slug}</p>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700">Meta Title</label>
                  <CharCount current={productMetaTitle.length} min={50} max={60} />
                </div>
                <input
                  type="text"
                  value={productMetaTitle}
                  onChange={e => { setProductMetaTitle(e.target.value); setProductSaved(false); }}
                  placeholder="Enter meta title (50-60 characters recommended)"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700">Meta Description</label>
                  <CharCount current={productMetaDesc.length} min={150} max={160} />
                </div>
                <textarea
                  value={productMetaDesc}
                  onChange={e => { setProductMetaDesc(e.target.value); setProductSaved(false); }}
                  rows={3}
                  placeholder="Enter meta description (150-160 characters recommended)"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <GooglePreview title={productMetaTitle} description={productMetaDesc} slug={selectedProduct.slug || ''} />

              <div className="flex items-center gap-3">
                <button
                  onClick={saveProductSeo}
                  disabled={savingProduct}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingProduct ? 'Saving...' : 'Save Product SEO'}
                </button>
                {productSaved && <span className="text-sm text-green-600 font-medium">Saved successfully</span>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4">Search and select a product above to edit its SEO metadata.</p>
          )}
        </div>
      )}

      {/* Page SEO Editor */}
      {activeTab === 'pages' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
          <h2 className="text-lg font-semibold text-slate-900">Page SEO Editor</h2>

          {audit && audit.pagesWithoutMeta.length > 0 ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Select a page</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {audit.pagesWithoutMeta.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectPage(p)}
                    className={`text-left p-3 border rounded-lg text-sm hover:border-indigo-300 transition-colors ${selectedPage?.id === p.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}
                  >
                    {p.title}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">All pages have SEO metadata configured. Select a page from the audit to edit.</p>
          )}

          {selectedPage && (
            <div className="space-y-4 border-t border-slate-100 pt-5">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-900">{selectedPage.title}</p>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700">Meta Title</label>
                  <CharCount current={pageMetaTitle.length} min={50} max={60} />
                </div>
                <input
                  type="text"
                  value={pageMetaTitle}
                  onChange={e => { setPageMetaTitle(e.target.value); setPageSaved(false); }}
                  placeholder="Enter meta title"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium text-slate-700">Meta Description</label>
                  <CharCount current={pageMetaDesc.length} min={150} max={160} />
                </div>
                <textarea
                  value={pageMetaDesc}
                  onChange={e => { setPageMetaDesc(e.target.value); setPageSaved(false); }}
                  rows={3}
                  placeholder="Enter meta description"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">OG Image URL</label>
                <input
                  type="url"
                  value={pageOgImage}
                  onChange={e => { setPageOgImage(e.target.value); setPageSaved(false); }}
                  placeholder="https://example.com/og-image.jpg"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                {pageOgImage && (
                  <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden">
                    <img src={pageOgImage} alt="OG Preview" className="w-full h-32 object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
              </div>

              <GooglePreview title={pageMetaTitle} description={pageMetaDesc} slug={(selectedPage as PageSeo).slug || 'page'} />

              <div className="flex items-center gap-3">
                <button
                  onClick={savePageSeo}
                  disabled={savingPage}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingPage ? 'Saving...' : 'Save Page SEO'}
                </button>
                {pageSaved && <span className="text-sm text-green-600 font-medium">Saved successfully</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sitemap */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Sitemap</h2>
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={handleGenerateSitemap}
            disabled={generatingSitemap}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {generatingSitemap ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {generatingSitemap ? 'Generating...' : 'Generate Sitemap'}
          </button>
          {sitemapUrl && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <a href={sitemapUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-green-700 underline">
                {sitemapUrl}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
