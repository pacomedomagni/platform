'use client';

import { Check } from 'lucide-react';

interface CheckoutProgressProps {
  currentStep: 'info' | 'payment' | 'confirmation';
}

const steps = [
  { id: 'info', name: 'Contact & Shipping', number: 1 },
  { id: 'payment', name: 'Payment', number: 2 },
  { id: 'confirmation', name: 'Confirmation', number: 3 },
];

export function CheckoutProgress({ currentStep }: CheckoutProgressProps) {
  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <nav aria-label="Checkout progress">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = step.id === currentStep;
          const isUpcoming = index > currentStepIndex;

          return (
            <li key={step.id} className="relative flex-1">
              {/* Connector Line */}
              {index !== steps.length - 1 && (
                <div
                  className="absolute left-[calc(50%+1.5rem)] top-5 hidden h-0.5 w-[calc(100%-3rem)] md:block"
                  aria-hidden="true"
                >
                  <div
                    className={`h-full transition-colors ${
                      isCompleted ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  />
                </div>
              )}

              {/* Step */}
              <div className="relative flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                    isCompleted
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : isCurrent
                      ? 'border-blue-600 bg-white text-blue-600'
                      : 'border-slate-300 bg-white text-slate-500'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-semibold">{step.number}</span>
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium transition-colors sm:text-sm ${
                    isCompleted || isCurrent ? 'text-slate-900' : 'text-slate-500'
                  }`}
                >
                  {step.name}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
