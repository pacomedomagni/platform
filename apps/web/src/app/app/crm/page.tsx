'use client';

import { useState, useEffect } from 'react';
import api from '../../../lib/api';

interface Customer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  orderCount?: number;
  totalSpent?: number;
  lastOrderDate?: string;
  createdAt: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Note {
  id: string;
  content: string;
  authorName?: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

const colorOptions = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];

export default function CrmPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  // Notes state
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState('');

  // Tags state
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [customerTags, setCustomerTags] = useState<Tag[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [showAddTag, setShowAddTag] = useState(false);

  const loadCustomers = async () => {
    try {
      const params: any = {};
      if (customerSearch) params.search = customerSearch;
      const res = await api.get('/v1/store/admin/customers', { params });
      setCustomers(res.data.data || res.data || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const res = await api.get('/v1/store/admin/crm/tags');
      setAllTags(res.data.data || res.data || []);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };

  useEffect(() => {
    loadCustomers();
    loadTags();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => { loadCustomers(); }, 300);
    return () => clearTimeout(debounce);
  }, [customerSearch]);

  const selectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setNotesLoading(true);
    try {
      const [notesRes, tagsRes] = await Promise.all([
        api.get(`/v1/store/admin/crm/notes/${customer.id}`),
        api.get(`/v1/store/admin/crm/customers/${customer.id}/tags`),
      ]);
      setNotes(notesRes.data.data || notesRes.data || []);
      setCustomerTags(tagsRes.data.data || tagsRes.data || []);
    } catch (err) {
      console.error('Failed to load customer details:', err);
    } finally {
      setNotesLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedCustomer) return;
    try {
      await api.post('/v1/store/admin/crm/notes', {
        storeCustomerId: selectedCustomer.id,
        content: newNote,
      });
      setNewNote('');
      const res = await api.get(`/v1/store/admin/crm/notes/${selectedCustomer.id}`);
      setNotes(res.data.data || res.data || []);
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    try {
      await api.put(`/v1/store/admin/crm/notes/${noteId}`, { content: editNoteContent });
      setEditingNote(null);
      if (selectedCustomer) {
        const res = await api.get(`/v1/store/admin/crm/notes/${selectedCustomer.id}`);
        setNotes(res.data.data || res.data || []);
      }
    } catch (err) {
      console.error('Failed to update note:', err);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      await api.delete(`/v1/store/admin/crm/notes/${noteId}`);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const handlePinNote = async (noteId: string, isPinned: boolean) => {
    try {
      await api.put(`/v1/store/admin/crm/notes/${noteId}`, { isPinned: !isPinned });
      if (selectedCustomer) {
        const res = await api.get(`/v1/store/admin/crm/notes/${selectedCustomer.id}`);
        setNotes(res.data.data || res.data || []);
      }
    } catch (err) {
      console.error('Failed to pin note:', err);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      await api.post('/v1/store/admin/crm/tags', { name: newTagName, color: newTagColor });
      setNewTagName('');
      setNewTagColor('#3B82F6');
      await loadTags();
    } catch (err) {
      console.error('Failed to create tag:', err);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Delete this tag?')) return;
    try {
      await api.delete(`/v1/store/admin/crm/tags/${tagId}`);
      await loadTags();
      if (selectedCustomer) {
        setCustomerTags((prev) => prev.filter((t) => t.id !== tagId));
      }
    } catch (err) {
      console.error('Failed to delete tag:', err);
    }
  };

  const handleLinkTag = async (tagId: string) => {
    if (!selectedCustomer) return;
    try {
      await api.post(`/v1/store/admin/crm/tags/${tagId}/link`, { storeCustomerId: selectedCustomer.id });
      const res = await api.get(`/v1/store/admin/crm/customers/${selectedCustomer.id}/tags`);
      setCustomerTags(res.data.data || res.data || []);
      setShowAddTag(false);
    } catch (err) {
      console.error('Failed to link tag:', err);
    }
  };

  const handleUnlinkTag = async (tagId: string) => {
    if (!selectedCustomer) return;
    try {
      await api.delete(`/v1/store/admin/crm/tags/${tagId}/link/${selectedCustomer.id}`);
      setCustomerTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch (err) {
      console.error('Failed to unlink tag:', err);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const customerName = (c: Customer) =>
    [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email;

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const availableTags = allTags.filter((t) => !customerTags.some((ct) => ct.id === t.id));

  return (
    <div className="p-6 lg:p-8 h-[calc(100vh-64px)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Customer CRM</h1>
          <p className="text-sm text-slate-500 mt-1">Manage customer relationships with notes and tags</p>
        </div>
        <button onClick={() => setShowTagModal(true)} className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 transition-colors">
          Manage Tags
        </button>
      </div>

      <div className="flex gap-6 h-[calc(100%-80px)]">
        {/* Left Sidebar - Customer List */}
        <div className="w-80 flex-shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-200">
            <input
              value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Search customers..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-sm text-slate-400 text-center">Loading...</p>
            ) : customers.length === 0 ? (
              <p className="p-4 text-sm text-slate-400 text-center">No customers found</p>
            ) : (
              customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectCustomer(c)}
                  className={`w-full text-left p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedCustomer?.id === c.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
                >
                  <p className="text-sm font-medium text-slate-900 truncate">{customerName(c)}</p>
                  <p className="text-xs text-slate-500 truncate">{c.email}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 overflow-y-auto">
          {!selectedCustomer ? (
            <div className="h-full flex items-center justify-center bg-white border border-slate-200 rounded-xl shadow-sm">
              <p className="text-slate-400 text-sm">Select a customer to view details</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Customer Header */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{customerName(selectedCustomer)}</h2>
                    <p className="text-sm text-slate-500 mt-1">{selectedCustomer.email}</p>
                    {selectedCustomer.phone && <p className="text-sm text-slate-500">{selectedCustomer.phone}</p>}
                  </div>
                </div>
                {/* Tags */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {customerTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                      <button onClick={() => handleUnlinkTag(tag.id)} className="ml-0.5 hover:opacity-75">&times;</button>
                    </span>
                  ))}
                  <div className="relative">
                    <button onClick={() => setShowAddTag(!showAddTag)}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-600 transition-colors">
                      + Add Tag
                    </button>
                    {showAddTag && availableTags.length > 0 && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1 min-w-[160px]">
                        {availableTags.map((tag) => (
                          <button key={tag.id} onClick={() => handleLinkTag(tag.id)}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-center gap-2 transition-colors">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <p className="text-xs text-slate-500">Total Orders</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{selectedCustomer.orderCount || 0}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <p className="text-xs text-slate-500">Total Spent</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{formatCurrency(selectedCustomer.totalSpent || 0)}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <p className="text-xs text-slate-500">Last Order</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{selectedCustomer.lastOrderDate ? formatDate(selectedCustomer.lastOrderDate) : 'Never'}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <p className="text-xs text-slate-500">Member Since</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{formatDate(selectedCustomer.createdAt)}</p>
                </div>
              </div>

              {/* Notes Section */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Notes</h3>
                {/* Add Note Form */}
                <div className="flex gap-2 mb-4">
                  <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    rows={2}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" />
                  <button onClick={handleAddNote} disabled={!newNote.trim()}
                    className="self-end px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    Add
                  </button>
                </div>
                {/* Notes List */}
                {notesLoading ? (
                  <p className="text-sm text-slate-400 text-center py-4">Loading notes...</p>
                ) : sortedNotes.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No notes yet</p>
                ) : (
                  <div className="space-y-3">
                    {sortedNotes.map((note) => (
                      <div key={note.id} className={`border rounded-lg p-3 ${note.isPinned ? 'border-yellow-300 bg-yellow-50' : 'border-slate-200'}`}>
                        {editingNote === note.id ? (
                          <div className="space-y-2">
                            <textarea value={editNoteContent} onChange={(e) => setEditNoteContent(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" />
                            <div className="flex gap-2">
                              <button onClick={() => handleUpdateNote(note.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Save</button>
                              <button onClick={() => setEditingNote(null)} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.content}</p>
                            <div className="flex items-center justify-between mt-2">
                              <div className="text-xs text-slate-400">
                                {note.authorName && <span>{note.authorName} &middot; </span>}
                                {formatDate(note.createdAt)}
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => handlePinNote(note.id, note.isPinned)}
                                  className={`text-xs font-medium ${note.isPinned ? 'text-yellow-600 hover:text-yellow-800' : 'text-slate-400 hover:text-slate-600'}`}>
                                  {note.isPinned ? 'Unpin' : 'Pin'}
                                </button>
                                <button onClick={() => { setEditingNote(note.id); setEditNoteContent(note.content); }}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                                <button onClick={() => handleDeleteNote(note.id)}
                                  className="text-xs text-red-600 hover:text-red-800 font-medium">Delete</button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tag Management Modal */}
      {showTagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Manage Tags</h2>
            {/* Create Tag */}
            <div className="flex gap-2 mb-4">
              <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
              <button onClick={handleCreateTag} disabled={!newTagName.trim()}
                className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                Create
              </button>
            </div>
            {/* Color Picker */}
            <div className="flex gap-2 mb-4">
              {colorOptions.map((color) => (
                <button key={color} onClick={() => setNewTagColor(color)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${newTagColor === color ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }} />
              ))}
            </div>
            {/* Tag List */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {allTags.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No tags created yet</p>
              ) : (
                allTags.map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between px-3 py-2 border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span className="text-sm font-medium text-slate-700">{tag.name}</span>
                    </div>
                    <button onClick={() => handleDeleteTag(tag.id)}
                      className="text-xs text-red-600 hover:text-red-800 font-medium">Delete</button>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end mt-6 pt-4 border-t border-slate-200">
              <button onClick={() => setShowTagModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
