'use client';

import { useState } from 'react';
import { AlertCircle, Mail, X } from 'lucide-react';
import { Button, Spinner } from '@platform/ui';
import { authApi } from '@/lib/store-api';

interface EmailVerificationBannerProps {
  email: string;
}

export function EmailVerificationBanner({ email }: EmailVerificationBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  if (!isVisible) return null;

  const handleResend = async () => {
    setIsResending(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      await authApi.resendVerificationEmail();
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (error) {
      setResendError(
        error instanceof Error
          ? error.message
          : 'Failed to resend verification email. Please try again later.'
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Mail className="h-5 w-5 text-amber-600" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900 mb-1">
                Email Verification Required
              </h3>
              <p className="text-sm text-amber-800 mb-3">
                Please verify your email address ({email}) to access all features. Check your inbox for the verification link.
              </p>

              {resendSuccess && (
                <div className="mb-3 p-2 rounded bg-green-50 border border-green-200">
                  <p className="text-sm text-green-800">
                    ✓ Verification email sent! Please check your inbox.
                  </p>
                </div>
              )}

              {resendError && (
                <div className="mb-3 p-2 rounded bg-red-50 border border-red-200">
                  <p className="text-sm text-red-800">
                    {resendError}
                  </p>
                </div>
              )}

              <Button
                onClick={handleResend}
                disabled={isResending || resendSuccess}
                size="sm"
                variant="outline"
                className="h-8 text-xs bg-white border-amber-300 text-amber-900 hover:bg-amber-50"
              >
                {isResending ? (
                  <>
                    <Spinner className="h-3 w-3 mr-2" />
                    Sending...
                  </>
                ) : resendSuccess ? (
                  'Email Sent ✓'
                ) : (
                  'Resend Verification Email'
                )}
              </Button>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              className="flex-shrink-0 text-amber-600 hover:text-amber-800"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
