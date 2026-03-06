'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from '@platform/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  RefreshCw,
  Send,
  ExternalLink,
} from 'lucide-react';
import { unwrapJson } from '@/lib/admin-fetch';

interface Message {
  id: string;
  sender: 'BUYER' | 'SELLER';
  senderUsername: string;
  body: string;
  sentDate: string;
}

interface MessageThread {
  id: string;
  connectionId: string;
  subject: string;
  buyerUsername: string;
  itemTitle?: string;
  itemId?: string;
  itemUrl?: string;
  status: 'OPEN' | 'RESPONDED' | 'CLOSED';
  messages: Message[];
}

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  OPEN: { label: 'Open', bg: 'bg-blue-100', text: 'text-blue-800' },
  RESPONDED: { label: 'Responded', bg: 'bg-green-100', text: 'text-green-800' },
  CLOSED: { label: 'Closed', bg: 'bg-gray-100', text: 'text-gray-800' },
};

export default function MarketplaceMessageThreadPage() {
  const params = useParams();
  const threadId = params.id as string;

  const [thread, setThread] = useState<MessageThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (threadId) {
      loadThread();
      markAsRead();
    }
  }, [threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [thread?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadThread = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/marketplace/messages/${threadId}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = unwrapJson<MessageThread>(await res.json());
        setThread(data);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load message thread',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to load thread:', error);
      toast({ title: 'Error', description: 'Failed to load message thread', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      await fetch(`/api/v1/marketplace/messages/${threadId}/read`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleReply = async () => {
    const body = replyBody.trim();
    if (!body) return;

    setSending(true);
    try {
      const res = await fetch(`/api/v1/marketplace/messages/${threadId}/reply`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });

      if (res.ok) {
        const newMessage = unwrapJson<Message>(await res.json());
        setThread((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: 'RESPONDED',
            messages: [...prev.messages, newMessage],
          };
        });
        setReplyBody('');
        toast({ title: 'Sent', description: 'Reply sent successfully' });
      } else {
        const error = unwrapJson(await res.json());
        toast({
          title: 'Error',
          description: error.error || 'Failed to send reply',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast({ title: 'Error', description: 'Failed to send reply', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleReply();
    }
  };

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link
          href="/app/marketplace/messages"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Messages
        </Link>
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Thread not found</h3>
          <p className="text-gray-600">This message thread could not be loaded.</p>
        </div>
      </div>
    );
  }

  const badge = STATUS_BADGES[thread.status] || STATUS_BADGES.OPEN;

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Back button */}
      <Link
        href="/app/marketplace/messages"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 self-start"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Messages
      </Link>

      {/* Thread header */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-gray-900 truncate">{thread.subject}</h1>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${badge.bg} ${badge.text}`}
              >
                {badge.label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span>
                From: <span className="font-medium text-gray-800">{thread.buyerUsername}</span>
              </span>
              {thread.itemTitle && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="flex items-center gap-1">
                    Item: <span className="font-medium text-gray-800">{thread.itemTitle}</span>
                    {thread.itemUrl && (
                      <a
                        href={thread.itemUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 space-y-4">
        {thread.messages.map((message) => {
          const isSeller = message.sender === 'SELLER';
          return (
            <div
              key={message.id}
              className={`flex ${isSeller ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-4 py-3 ${
                  isSeller
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-900 border border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-medium ${
                      isSeller ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {message.senderUsername}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                <div
                  className={`text-xs mt-2 ${
                    isSeller ? 'text-blue-200' : 'text-gray-400'
                  }`}
                >
                  {formatMessageDate(message.sentDate)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply form */}
      {thread.status !== 'CLOSED' ? (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your reply..."
              rows={3}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
            <div className="flex flex-col justify-end">
              <button
                onClick={handleReply}
                disabled={sending || !replyBody.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Press Cmd+Enter or Ctrl+Enter to send
          </p>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-500">
          This conversation is closed and cannot receive new replies.
        </div>
      )}
    </div>
  );
}
