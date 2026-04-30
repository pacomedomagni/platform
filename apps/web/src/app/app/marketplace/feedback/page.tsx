'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from '@platform/ui';
import { RefreshCw, ThumbsUp, ThumbsDown, Minus, Star, MessageSquare, X } from 'lucide-react';
import api from '@/lib/api';

interface Connection {
  id: string;
  name: string;
  platform: string;
  marketplaceId: string;
  isConnected: boolean;
}

interface FeedbackEntry {
  FeedbackID: string;
  CommentingUser: string;
  CommentText: string;
  CommentType: 'Positive' | 'Neutral' | 'Negative';
  CommentTime: string;
  ItemID?: string;
  ItemTitle?: string;
  Role?: string;
}

interface FeedbackSummary {
  feedbackScore: number;
  positiveFeedbackPercent: number;
  uniquePositiveCount: number;
  uniqueNegativeCount: number;
  uniqueNeutralCount: number;
  totalEntries: number;
  recentRatings: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

const RATING_CONFIG: Record<string, { label: string; bg: string; text: string; icon: typeof ThumbsUp }> = {
  Positive: { label: 'Positive', bg: 'bg-green-100', text: 'text-green-800', icon: ThumbsUp },
  Neutral: { label: 'Neutral', bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Minus },
  Negative: { label: 'Negative', bg: 'bg-red-100', text: 'text-red-800', icon: ThumbsDown },
};

function RatingBadge({ type }: { type: string }) {
  const config = RATING_CONFIG[type] || RATING_CONFIG.Neutral;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'short' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MarketplaceFeedbackPage() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [ratingFilter, setRatingFilter] = useState<string>('all');

  // Respond modal state
  const [respondModal, setRespondModal] = useState<FeedbackEntry | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    if (selectedConnection) {
      loadFeedback();
      loadSummary();
    } else {
      setEntries([]);
      setSummary(null);
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConnection]);

  const loadConnections = async () => {
    try {
      const res = await api.get<Connection[]>('/v1/marketplace/connections');
      setConnections(res.data);
      if (res.data.length > 0) {
        setSelectedConnection(res.data[0].id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Failed to load connections:', error);
      setLoading(false);
    }
  };

  const loadFeedback = useCallback(async () => {
    if (!selectedConnection) return;
    setLoading(true);
    try {
      const res = await api.get<{ feedbackEntries: FeedbackEntry[]; totalEntries: number }>(
        '/v1/marketplace/feedback',
        { params: { connectionId: selectedConnection } },
      );
      setEntries(res.data.feedbackEntries || []);
    } catch (error: any) {
      console.error('Failed to load feedback:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Failed to load feedback',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedConnection]);

  const loadSummary = useCallback(async () => {
    if (!selectedConnection) return;
    setSummaryLoading(true);
    try {
      const res = await api.get<FeedbackSummary>('/v1/marketplace/feedback/summary', {
        params: { connectionId: selectedConnection },
      });
      setSummary(res.data);
    } catch (error) {
      console.error('Failed to load feedback summary:', error);
    } finally {
      setSummaryLoading(false);
    }
  }, [selectedConnection]);

  const handleRespond = async () => {
    if (!respondModal || !responseText.trim()) {
      toast({ title: 'Validation Error', description: 'Please enter a response', variant: 'destructive' });
      return;
    }
    setResponding(true);
    try {
      await api.post('/v1/marketplace/feedback/respond', {
        connectionId: selectedConnection,
        feedbackId: respondModal.FeedbackID,
        responseText: responseText.trim(),
      });
      toast({ title: 'Success', description: 'Response submitted successfully' });
      setRespondModal(null);
      setResponseText('');
    } catch (error: any) {
      console.error('Failed to respond to feedback:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Failed to submit response',
        variant: 'destructive',
      });
    } finally {
      setResponding(false);
    }
  };

  const filteredEntries = ratingFilter === 'all'
    ? entries
    : entries.filter((e) => e.CommentType === ratingFilter);

  if (loading && connections.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Feedback</h1>
          <p className="text-gray-600 mt-2">Buyer feedback from your eBay stores</p>
        </div>
        <button
          onClick={() => { loadFeedback(); loadSummary(); }}
          disabled={!selectedConnection || loading}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
            <select
              value={selectedConnection}
              onChange={(e) => setSelectedConnection(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {connections.length === 0 && <option value="">No stores connected</option>}
              {connections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name} ({conn.marketplaceId})
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Ratings</option>
              <option value="Positive">Positive</option>
              <option value="Neutral">Neutral</option>
              <option value="Negative">Negative</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {selectedConnection && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Score</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {summaryLoading ? '—' : (summary?.feedbackScore ?? '—')}
            </p>
            {summary && (
              <p className="text-xs text-gray-500 mt-1">{summary.positiveFeedbackPercent.toFixed(1)}% positive</p>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <ThumbsUp className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Positive</span>
            </div>
            <p className="text-2xl font-bold text-green-700">
              {summaryLoading ? '—' : (summary?.uniquePositiveCount ?? '—')}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Minus className="w-4 h-4 text-yellow-600" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Neutral</span>
            </div>
            <p className="text-2xl font-bold text-yellow-700">
              {summaryLoading ? '—' : (summary?.uniqueNeutralCount ?? '—')}
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <ThumbsDown className="w-4 h-4 text-red-600" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Negative</span>
            </div>
            <p className="text-2xl font-bold text-red-700">
              {summaryLoading ? '—' : (summary?.uniqueNegativeCount ?? '—')}
            </p>
          </div>
        </div>
      )}

      {/* Feedback List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : !selectedConnection ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <MessageSquare className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No store selected</h3>
          <p className="text-gray-600">Connect an eBay store to view your feedback</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <MessageSquare className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No feedback found</h3>
          <p className="text-gray-600">
            {ratingFilter !== 'all'
              ? 'Try adjusting your rating filter to see more results'
              : 'Feedback from your buyers will appear here'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filteredEntries.map((entry) => (
              <div key={entry.FeedbackID} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Top row: buyer, rating, date */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-gray-900">{entry.CommentingUser}</span>
                      <RatingBadge type={entry.CommentType} />
                      <span className="text-xs text-gray-500">{formatDate(entry.CommentTime)}</span>
                    </div>

                    {/* Comment */}
                    <p className="text-sm text-gray-700 mb-2">{entry.CommentText}</p>

                    {/* Item info */}
                    {entry.ItemTitle && (
                      <p className="text-xs text-gray-500 truncate">
                        Item: {entry.ItemTitle}
                        {entry.ItemID && (
                          <span className="ml-1 text-gray-400">(#{entry.ItemID})</span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Respond button */}
                  <button
                    onClick={() => {
                      setResponseText('');
                      setRespondModal(entry);
                    }}
                    className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    Respond
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Respond Modal */}
      {respondModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Respond to Feedback</h2>
              <button
                onClick={() => { setRespondModal(null); setResponseText(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Original feedback summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-900">{respondModal.CommentingUser}</span>
                <RatingBadge type={respondModal.CommentType} />
                <span className="text-xs text-gray-500">{formatDate(respondModal.CommentTime)}</span>
              </div>
              <p className="text-sm text-gray-700">{respondModal.CommentText}</p>
              {respondModal.ItemTitle && (
                <p className="text-xs text-gray-500 mt-2 truncate">Item: {respondModal.ItemTitle}</p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Response <span className="text-red-500">*</span>
              </label>
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Write your response to this feedback..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setRespondModal(null); setResponseText(''); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRespond}
                disabled={responding || !responseText.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2"
              >
                {responding && <RefreshCw className="w-4 h-4 animate-spin" />}
                {responding ? 'Submitting...' : 'Submit Response'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
