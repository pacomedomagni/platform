'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@platform/ui';
import { useOnboardingStore } from '../../lib/onboarding-store';

interface TourStep {
  target: string;
  title: string;
  content: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '#header-search',
    title: 'Search Products',
    content: 'Quickly find what you need with our intelligent search. Search by name, category, or SKU.',
    placement: 'bottom',
  },
  {
    target: '[href="/storefront/cart"]',
    title: 'Shopping Cart',
    content: 'View and manage your cart items. Your cart syncs across all devices.',
    placement: 'bottom',
  },
  {
    target: '[href="/storefront/account"]',
    title: 'Your Account',
    content: 'Access your profile, orders, addresses, and preferences here.',
    placement: 'bottom',
  },
  {
    target: '[href="/storefront/products"]',
    title: 'Browse Products',
    content: 'Explore our catalog with powerful filters and real-time inventory updates.',
    placement: 'bottom',
  },
];

export function ProductTour() {
  const { showTour, setShowTour, completeStep } = useOnboardingStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!showTour) return;

    const updatePosition = () => {
      const step = TOUR_STEPS[currentStep];
      const element = document.querySelector(step.target) as HTMLElement;

      if (element) {
        setTargetElement(element);
        const rect = element.getBoundingClientRect();

        let top = 0;
        let left = 0;

        switch (step.placement) {
          case 'bottom':
            top = rect.bottom + window.scrollY + 10;
            left = rect.left + window.scrollX + rect.width / 2;
            break;
          case 'top':
            top = rect.top + window.scrollY - 10;
            left = rect.left + window.scrollX + rect.width / 2;
            break;
          case 'right':
            top = rect.top + window.scrollY + rect.height / 2;
            left = rect.right + window.scrollX + 10;
            break;
          case 'left':
            top = rect.top + window.scrollY + rect.height / 2;
            left = rect.left + window.scrollX - 10;
            break;
        }

        setPosition({ top, left });

        // Highlight the target element
        element.style.position = 'relative';
        element.style.zIndex = '1000';
        element.classList.add('tour-highlight');
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);

      // Remove highlight
      if (targetElement) {
        targetElement.style.zIndex = '';
        targetElement.classList.remove('tour-highlight');
      }
    };
  }, [showTour, currentStep]);

  if (!showTour) return null;

  const step = TOUR_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      if (targetElement) {
        targetElement.style.zIndex = '';
        targetElement.classList.remove('tour-highlight');
      }
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      if (targetElement) {
        targetElement.style.zIndex = '';
        targetElement.classList.remove('tour-highlight');
      }
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (targetElement) {
      targetElement.style.zIndex = '';
      targetElement.classList.remove('tour-highlight');
    }
    await completeStep('tour');
    setShowTour(false);
    setCurrentStep(0);
  };

  const handleSkip = () => {
    if (targetElement) {
      targetElement.style.zIndex = '';
      targetElement.classList.remove('tour-highlight');
    }
    setShowTour(false);
    setCurrentStep(0);
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/40 z-[999]" onClick={handleSkip} />

      {/* Spotlight effect */}
      {targetElement && (
        <div
          className="fixed z-[1001] pointer-events-none"
          style={{
            top: targetElement.getBoundingClientRect().top - 4,
            left: targetElement.getBoundingClientRect().left - 4,
            width: targetElement.offsetWidth + 8,
            height: targetElement.offsetHeight + 8,
            boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 9999px rgba(0, 0, 0, 0.4)',
            borderRadius: '8px',
            transition: 'all 0.3s ease',
          }}
        />
      )}

      {/* Tour Tooltip */}
      <div
        className="fixed z-[1002] bg-white rounded-lg shadow-2xl max-w-sm animate-in fade-in zoom-in-95"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          transform:
            step.placement === 'bottom' || step.placement === 'top'
              ? 'translateX(-50%)'
              : 'translateY(-50%)',
        }}
      >
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 mb-1">{step.title}</h3>
              <p className="text-sm text-slate-600">{step.content}</p>
            </div>
            <button
              onClick={handleSkip}
              className="text-slate-400 hover:text-slate-600 transition-colors ml-2"
              aria-label="Close tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress Indicators */}
          <div className="flex items-center gap-1 mb-4">
            {TOUR_STEPS.map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  index <= currentStep ? 'bg-blue-600' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Step {currentStep + 1} of {TOUR_STEPS.length}
            </div>
            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <Button variant="outline" size="sm" onClick={handleBack}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              <Button size="sm" onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                {isLastStep ? 'Finish' : 'Next'}
                {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div
          className={`absolute w-3 h-3 bg-white transform rotate-45 ${
            step.placement === 'bottom'
              ? '-top-1.5 left-1/2 -translate-x-1/2'
              : step.placement === 'top'
              ? '-bottom-1.5 left-1/2 -translate-x-1/2'
              : step.placement === 'right'
              ? '-left-1.5 top-1/2 -translate-y-1/2'
              : '-right-1.5 top-1/2 -translate-y-1/2'
          }`}
        />
      </div>

      {/* Global styles for tour highlight */}
      <style jsx global>{`
        .tour-highlight {
          animation: tour-pulse 2s infinite;
        }

        @keyframes tour-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
          }
        }
      `}</style>
    </>
  );
}
