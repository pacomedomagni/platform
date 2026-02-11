'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { resolveTenantId } from '@/lib/store-api';

interface EmailPreferences {
  marketing: boolean;
  orderUpdates: boolean;
  promotions: boolean;
  newsletter: boolean;
  unsubscribedAt: string | null;
}

/** Get common headers for email preferences API calls */
async function getEmailApiHeaders(): Promise<HeadersInit> {
  const tenantId = await resolveTenantId();
  const token = typeof window !== 'undefined' ? localStorage.getItem('customer_token') : null;
  return {
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export default function EmailPreferencesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<EmailPreferences>({
    marketing: true,
    orderUpdates: true,
    promotions: true,
    newsletter: true,
    unsubscribedAt: null,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const headers = await getEmailApiHeaders();
      const response = await fetch('/api/v1/storefront/email-preferences', {
        headers,
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data);
      } else if (response.status === 401) {
        router.push('/storefront/account/login?redirect=/storefront/account/email-preferences');
      } else {
        setMessage({ type: 'error', text: 'Failed to load preferences' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof Omit<EmailPreferences, 'unsubscribedAt'>) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const headers = await getEmailApiHeaders();
      const response = await fetch('/api/v1/storefront/email-preferences', {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          marketing: preferences.marketing,
          orderUpdates: preferences.orderUpdates,
          promotions: preferences.promotions,
          newsletter: preferences.newsletter,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Preferences saved successfully' });
        fetchPreferences();
      } else {
        setMessage({ type: 'error', text: 'Failed to save preferences' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setSaving(false);
    }
  };

  const handleUnsubscribeAll = async () => {
    if (!confirm('Are you sure you want to unsubscribe from all emails?')) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const headers = await getEmailApiHeaders();
      const response = await fetch('/api/v1/storefront/email-preferences/unsubscribe/all', {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Unsubscribed from all emails' });
        fetchPreferences();
      } else {
        setMessage({ type: 'error', text: 'Failed to unsubscribe' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">
              Email Preferences
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage which emails you receive from us
            </p>
          </div>

          <div className="px-6 py-5 space-y-6">
            {message && (
              <div
                className={`rounded-md p-4 ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                {message.text}
              </div>
            )}

            {preferences.unsubscribedAt && (
              <div className="rounded-md bg-yellow-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-yellow-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      You are currently unsubscribed from all emails
                    </h3>
                    <p className="mt-1 text-sm text-yellow-700">
                      Update your preferences below to start receiving emails again.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <PreferenceToggle
                label="Marketing Emails"
                description="Receive special offers, new products, and promotional content"
                checked={preferences.marketing}
                onChange={() => handleToggle('marketing')}
              />

              <PreferenceToggle
                label="Order Updates"
                description="Get notified about your order status, shipping, and delivery"
                checked={preferences.orderUpdates}
                onChange={() => handleToggle('orderUpdates')}
              />

              <PreferenceToggle
                label="Promotions"
                description="Receive information about sales, discounts, and special deals"
                checked={preferences.promotions}
                onChange={() => handleToggle('promotions')}
              />

              <PreferenceToggle
                label="Newsletter"
                description="Stay updated with our monthly newsletter and blog posts"
                checked={preferences.newsletter}
                onChange={() => handleToggle('newsletter')}
              />
            </div>

            <div className="border-t border-gray-200 pt-6 flex items-center justify-between">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>

              <button
                onClick={handleUnsubscribeAll}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-200"
              >
                Unsubscribe from All
              </button>
            </div>

            <div className="bg-gray-50 rounded-md p-4">
              <p className="text-xs text-gray-600">
                Note: You will continue to receive important transactional emails
                such as password resets and account notifications regardless of these
                preferences.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <a
            href="/storefront/account"
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            ← Back to Account
          </a>
        </div>
      </div>
    </div>
  );
}

interface PreferenceToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

function PreferenceToggle({ label, description, checked, onChange }: PreferenceToggleProps) {
  return (
    <div className="flex items-start justify-between py-4 border-b border-gray-200">
      <div className="flex-1">
        <h3 className="text-sm font-medium text-gray-900">{label}</h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`${
          checked ? 'bg-blue-600' : 'bg-gray-200'
        } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
        role="switch"
        aria-checked={checked}
      >
        <span
          aria-hidden="true"
          className={`${
            checked ? 'translate-x-5' : 'translate-x-0'
          } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
        />
      </button>
    </div>
  );
}
