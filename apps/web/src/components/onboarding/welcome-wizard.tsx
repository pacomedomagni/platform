'use client';

import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, User, ShoppingBag, Gift } from 'lucide-react';
import { Button, Input, Card } from '@platform/ui';
import { useOnboardingStore } from '../../lib/onboarding-store';
import { useAuthStore } from '../../lib/auth-store';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to NoSlag Storefront!',
    subtitle: 'Your premium inventory-first shopping experience',
  },
  {
    id: 'profile',
    title: 'Complete Your Profile',
    subtitle: 'Help us personalize your experience',
  },
  {
    id: 'tour',
    title: 'Quick Feature Tour',
    subtitle: 'Discover what makes NoSlag special',
  },
  {
    id: 'incentive',
    title: 'Welcome Gift',
    subtitle: 'A special offer just for you',
  },
];

export function WelcomeWizard() {
  const { showWizard, setShowWizard, status, updateStep, dismissOnboarding, updateProfile } = useOnboardingStore();
  const { customer } = useAuthStore();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [profileData, setProfileData] = useState({
    firstName: customer?.firstName || '',
    lastName: customer?.lastName || '',
    phone: customer?.phone || '',
  });

  useEffect(() => {
    if (status?.currentStep) {
      const stepIndex = STEPS.findIndex((s) => s.id === status.currentStep);
      if (stepIndex >= 0) {
        setCurrentStepIndex(stepIndex);
      }
    }
  }, [status?.currentStep]);

  if (!showWizard || !customer) {
    return null;
  }

  const currentStep = STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  const handleNext = async () => {
    if (currentStep.id === 'profile') {
      await updateProfile(profileData);
    }

    if (isLastStep) {
      await dismissOnboarding();
      setShowWizard(false);
    } else {
      const nextStep = STEPS[currentStepIndex + 1];
      await updateStep(nextStep.id);
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      const prevStep = STEPS[currentStepIndex - 1];
      updateStep(prevStep.id);
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleSkip = () => {
    dismissOnboarding();
    setShowWizard(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <Card className="relative w-full max-w-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 via-blue-500 to-amber-400 text-white flex items-center justify-center font-semibold shadow-sm">
                N
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{currentStep.title}</h2>
                <p className="text-sm text-slate-500">{currentStep.subtitle}</p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Close wizard"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Progress Dots */}
          <div className="mt-6 flex items-center justify-center gap-2">
            {STEPS.map((step, index) => (
              <button
                key={step.id}
                onClick={() => {
                  if (index <= currentStepIndex) {
                    updateStep(step.id);
                    setCurrentStepIndex(index);
                  }
                }}
                className={`h-2 rounded-full transition-all ${
                  index === currentStepIndex
                    ? 'w-8 bg-gradient-to-r from-indigo-600 to-blue-500'
                    : index < currentStepIndex
                    ? 'w-2 bg-blue-500 cursor-pointer hover:bg-blue-600'
                    : 'w-2 bg-slate-300'
                }`}
                aria-label={`Go to ${step.title}`}
                disabled={index > currentStepIndex}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {currentStep.id === 'welcome' && <WelcomeStep />}
          {currentStep.id === 'profile' && (
            <ProfileStep profileData={profileData} setProfileData={setProfileData} />
          )}
          {currentStep.id === 'tour' && <TourStep />}
          {currentStep.id === 'incentive' && <IncentiveStep />}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-6 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Skip for now
          </button>
          <div className="flex items-center gap-3">
            {!isFirstStep && (
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button onClick={handleNext} className="bg-gradient-to-r from-indigo-600 to-blue-600">
              {isLastStep ? 'Get Started' : 'Next'}
              {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
        <Sparkles className="h-10 w-10 text-indigo-600" />
      </div>
      <div className="space-y-2">
        <h3 className="text-2xl font-semibold text-slate-900">
          Welcome to Your Premium Shopping Experience
        </h3>
        <p className="text-slate-600 max-w-lg mx-auto">
          NoSlag combines ERP-grade inventory control with a beautiful, modern storefront. Real-time
          stock visibility, multi-location fulfillment, and seamless checkout - all in one place.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 pt-4">
        <div className="p-4 rounded-lg bg-slate-50">
          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-2">
            <ShoppingBag className="h-5 w-5 text-indigo-600" />
          </div>
          <p className="text-sm font-medium text-slate-900">Smart Inventory</p>
          <p className="text-xs text-slate-500 mt-1">Real-time stock tracking</p>
        </div>
        <div className="p-4 rounded-lg bg-slate-50">
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
            <User className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-sm font-medium text-slate-900">Personalized</p>
          <p className="text-xs text-slate-500 mt-1">Tailored for you</p>
        </div>
        <div className="p-4 rounded-lg bg-slate-50">
          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-2">
            <Gift className="h-5 w-5 text-amber-600" />
          </div>
          <p className="text-sm font-medium text-slate-900">Rewards</p>
          <p className="text-xs text-slate-500 mt-1">Exclusive benefits</p>
        </div>
      </div>
    </div>
  );
}

function ProfileStep({
  profileData,
  setProfileData,
}: {
  profileData: any;
  setProfileData: any;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
          <User className="h-8 w-8 text-indigo-600" />
        </div>
        <p className="text-slate-600">
          These details help us personalize your shopping experience (all optional)
        </p>
      </div>
      <div className="space-y-4 max-w-md mx-auto">
        <div className="space-y-2">
          <label htmlFor="firstName" className="text-sm font-medium text-slate-700">
            First Name
          </label>
          <Input
            id="firstName"
            type="text"
            placeholder="John"
            value={profileData.firstName}
            onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="lastName" className="text-sm font-medium text-slate-700">
            Last Name
          </label>
          <Input
            id="lastName"
            type="text"
            placeholder="Doe"
            value={profileData.lastName}
            onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="phone" className="text-sm font-medium text-slate-700">
            Phone Number
          </label>
          <Input
            id="phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={profileData.phone}
            onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}

function TourStep() {
  const { setShowTour } = useOnboardingStore();

  const features = [
    {
      icon: '🔍',
      title: 'Search Bar',
      description: 'Find products instantly with our powerful search',
    },
    {
      icon: '🛒',
      title: 'Shopping Cart',
      description: 'Easy access to your cart at all times',
    },
    {
      icon: '👤',
      title: 'Account Menu',
      description: 'Manage orders, addresses, and preferences',
    },
    {
      icon: '🎯',
      title: 'Product Filters',
      description: 'Narrow down products by category, price, and more',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-slate-600">
          Here are the key features to help you navigate the store
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {features.map((feature, index) => (
          <div key={index} className="p-4 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors">
            <div className="text-3xl mb-2">{feature.icon}</div>
            <h4 className="font-semibold text-slate-900 mb-1">{feature.title}</h4>
            <p className="text-sm text-slate-600">{feature.description}</p>
          </div>
        ))}
      </div>
      <div className="text-center pt-4">
        <button
          onClick={() => {
            setShowTour(true);
          }}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Start interactive tour after this
        </button>
      </div>
    </div>
  );
}

function IncentiveStep() {
  const [copied, setCopied] = useState(false);
  const discountCode = 'WELCOME10';

  const handleCopy = () => {
    navigator.clipboard.writeText(discountCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
        <Gift className="h-10 w-10 text-amber-600" />
      </div>
      <div className="space-y-2">
        <h3 className="text-2xl font-semibold text-slate-900">
          Welcome Gift: 10% Off Your First Purchase!
        </h3>
        <p className="text-slate-600">
          Use this exclusive discount code at checkout
        </p>
      </div>
      <div className="max-w-md mx-auto">
        <div className="p-6 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-dashed border-indigo-200">
          <p className="text-sm text-slate-600 mb-2">Your discount code</p>
          <div className="flex items-center justify-between gap-3">
            <code className="text-2xl font-bold text-indigo-600 tracking-wider">{discountCode}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? '✓ Copied' : 'Copy Code'}
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-3">Valid for 30 days on orders over $50</p>
        </div>
      </div>
      <div className="pt-4">
        <p className="text-sm text-slate-600">
          The code has been saved to your account and will be automatically applied at checkout!
        </p>
      </div>
    </div>
  );
}
