'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, X, ChevronRight } from 'lucide-react';
import { Card, Button } from '@platform/ui';
import { useOnboardingStore } from '../../lib/onboarding-store';
import { useAuthStore } from '../../lib/auth-store';

export function OnboardingChecklist() {
  const { status, fetchStatus, dismissOnboarding, isLoading } = useOnboardingStore();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchStatus();
    }
  }, [isAuthenticated, fetchStatus]);

  if (!isAuthenticated || isLoading || !status || status.completed) {
    return null;
  }

  const checklist = status.checklist;
  const checklistItems = [
    {
      id: 'emailVerified',
      label: 'Verify your email',
      completed: checklist.emailVerified,
      href: '/storefront/account',
      description: 'Check your inbox for verification link',
    },
    {
      id: 'profileCompleted',
      label: 'Complete your profile',
      completed: checklist.profileCompleted,
      href: '/storefront/account',
      description: 'Add your name and phone number',
    },
    {
      id: 'addedToCart',
      label: 'Add first item to cart',
      completed: checklist.addedToCart,
      href: '/storefront/products',
      description: 'Browse our products and add to cart',
    },
    {
      id: 'completedFirstPurchase',
      label: 'Complete your first purchase',
      completed: checklist.completedFirstPurchase,
      href: '/storefront/cart',
      description: 'Checkout and place your first order',
    },
    {
      id: 'addedShippingAddress',
      label: 'Add shipping address',
      completed: checklist.addedShippingAddress,
      href: '/storefront/account/addresses',
      description: 'Save your delivery address',
    },
  ];

  const completedCount = checklistItems.filter((item) => item.completed).length;
  const totalCount = checklistItems.length;
  const progressPercentage = Math.round((completedCount / totalCount) * 100);

  return (
    <Card className="border-slate-200/70 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200/70 bg-gradient-to-r from-indigo-50 to-blue-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              Welcome Checklist
              <span className="text-sm font-normal text-slate-600">
                ({completedCount}/{totalCount} completed)
              </span>
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Complete these steps to get the most out of NoSlag Storefront
            </p>
          </div>
          <button
            onClick={() => dismissOnboarding()}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            aria-label="Dismiss checklist"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-slate-600">Progress</span>
            <span className="font-semibold text-indigo-600">{progressPercentage}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-600 to-blue-600 transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {checklistItems.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="block p-4 hover:bg-slate-50 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="pt-0.5">
                {item.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300 group-hover:text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p
                    className={`font-medium ${
                      item.completed
                        ? 'text-slate-500 line-through'
                        : 'text-slate-900 group-hover:text-indigo-600'
                    }`}
                  >
                    {item.label}
                  </p>
                  {!item.completed && (
                    <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{item.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {progressPercentage === 100 && (
        <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-t border-green-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-900">All done!</p>
              <p className="text-sm text-green-700 mt-0.5">
                You've completed all onboarding steps
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => dismissOnboarding()}
              className="bg-green-600 hover:bg-green-700"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
