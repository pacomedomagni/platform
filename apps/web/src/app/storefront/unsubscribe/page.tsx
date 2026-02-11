'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const type = searchParams.get('type') || 'all';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid unsubscribe link. Please check your email for the correct link.');
      return;
    }

    // Call unsubscribe API
    const unsubscribe = async () => {
      try {
        const response = await fetch(
          `/api/v1/storefront/email-preferences/unsubscribe?token=${encodeURIComponent(token)}&type=${type}`,
          {
            method: 'GET',
          },
        );

        if (response.ok) {
          const data = await response.json();
          setStatus('success');
          setMessage(data.message || 'You have been successfully unsubscribed.');
        } else {
          setStatus('error');
          setMessage('Failed to unsubscribe. The link may be invalid or expired.');
        }
      } catch (error) {
        setStatus('error');
        setMessage('An error occurred while processing your request.');
      }
    };

    unsubscribe();
  }, [token, type]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        {status === 'loading' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Processing...
            </h1>
            <p className="text-gray-600">
              Please wait while we process your request.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Unsubscribed
            </h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
              <p className="text-sm text-gray-700">
                You will no longer receive {type === 'all' ? 'any' : type} emails
                from us. You can update your preferences at any time by logging
                into your account.
              </p>
            </div>
            <div className="space-y-2">
              <a
                href="/storefront/account/email-preferences"
                className="block w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Manage Email Preferences
              </a>
              <a
                href="/storefront"
                className="block w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
              >
                Return to Store
              </a>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Error
            </h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="space-y-2">
              <a
                href="/storefront/account/email-preferences"
                className="block w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Manage Email Preferences
              </a>
              <a
                href="/storefront"
                className="block w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
              >
                Return to Store
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


export default function UnsubscribePage() {
  return (
    <Suspense>
      <UnsubscribeContent />
    </Suspense>
  );
}
