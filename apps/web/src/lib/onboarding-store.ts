import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OnboardingChecklist {
  emailVerified: boolean;
  profileCompleted: boolean;
  addedToCart: boolean;
  completedFirstPurchase: boolean;
  addedShippingAddress: boolean;
}

export interface OnboardingStatus {
  completed: boolean;
  currentStep: string | null;
  profileCompletionScore: number;
  checklist: OnboardingChecklist;
  hasViewedProductTour: boolean;
}

interface OnboardingStore {
  // State
  status: OnboardingStatus | null;
  showWizard: boolean;
  showTour: boolean;
  isLoading: boolean;

  // Actions
  setStatus: (status: OnboardingStatus) => void;
  setShowWizard: (show: boolean) => void;
  setShowTour: (show: boolean) => void;
  fetchStatus: () => Promise<void>;
  completeStep: (step: string) => Promise<void>;
  updateStep: (step: string) => Promise<void>;
  dismissOnboarding: () => Promise<void>;
  updateProfile: (data: { firstName?: string; lastName?: string; phone?: string }) => Promise<void>;
  resetTour: () => Promise<void>;
  reset: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set, get) => ({
      // Initial state
      status: null,
      showWizard: false,
      showTour: false,
      isLoading: false,

      // Set status
      setStatus: (status) => {
        set({ status });

        // Auto-show wizard for new users who haven't completed onboarding
        if (!status.completed && status.currentStep !== 'completed') {
          // Only show wizard if it's not already dismissed in this session
          const dismissed = sessionStorage.getItem('onboarding-wizard-dismissed');
          if (!dismissed) {
            set({ showWizard: true });
          }
        }

        // Auto-show tour if not viewed
        if (!status.hasViewedProductTour && status.completed) {
          const tourDismissed = sessionStorage.getItem('product-tour-dismissed');
          if (!tourDismissed) {
            setTimeout(() => set({ showTour: true }), 2000);
          }
        }
      },

      // Toggle wizard visibility
      setShowWizard: (show) => {
        set({ showWizard: show });
        if (!show) {
          sessionStorage.setItem('onboarding-wizard-dismissed', 'true');
        }
      },

      // Toggle tour visibility
      setShowTour: (show) => {
        set({ showTour: show });
        if (!show) {
          sessionStorage.setItem('product-tour-dismissed', 'true');
        }
      },

      // Fetch onboarding status from API
      fetchStatus: async () => {
        set({ isLoading: true });
        try {
          const token = localStorage.getItem('customer_token');
          if (!token) {
            set({ isLoading: false });
            return;
          }

          const response = await fetch(`${API_BASE_URL}/api/v1/store/onboarding/status`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const status = await response.json();
            get().setStatus(status);
          }
        } catch (error) {
          console.error('Failed to fetch onboarding status:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      // Complete a step
      completeStep: async (step: string) => {
        try {
          const token = localStorage.getItem('customer_token');
          if (!token) return;

          const response = await fetch(`${API_BASE_URL}/api/v1/store/onboarding/complete-step`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ step }),
          });

          if (response.ok) {
            const status = await response.json();
            set({ status });
          }
        } catch (error) {
          console.error('Failed to complete step:', error);
        }
      },

      // Update current step
      updateStep: async (step: string) => {
        try {
          const token = localStorage.getItem('customer_token');
          if (!token) return;

          await fetch(`${API_BASE_URL}/api/v1/store/onboarding/update-step`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ step }),
          });

          const currentStatus = get().status;
          if (currentStatus) {
            set({
              status: {
                ...currentStatus,
                currentStep: step,
              },
            });
          }
        } catch (error) {
          console.error('Failed to update step:', error);
        }
      },

      // Dismiss onboarding
      dismissOnboarding: async () => {
        try {
          const token = localStorage.getItem('customer_token');
          if (!token) return;

          await fetch(`${API_BASE_URL}/api/v1/store/onboarding/dismiss`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const currentStatus = get().status;
          if (currentStatus) {
            set({
              status: {
                ...currentStatus,
                completed: true,
                currentStep: 'completed',
              },
              showWizard: false,
            });
          }
        } catch (error) {
          console.error('Failed to dismiss onboarding:', error);
        }
      },

      // Update profile
      updateProfile: async (data) => {
        try {
          const token = localStorage.getItem('customer_token');
          if (!token) return;

          const response = await fetch(`${API_BASE_URL}/api/v1/store/onboarding/update-profile`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
          });

          if (response.ok) {
            const status = await response.json();
            set({ status });
          }
        } catch (error) {
          console.error('Failed to update profile:', error);
        }
      },

      // Reset tour to show again
      resetTour: async () => {
        try {
          const token = localStorage.getItem('customer_token');
          if (!token) return;

          await fetch(`${API_BASE_URL}/api/v1/store/onboarding/reset-tour`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          const currentStatus = get().status;
          if (currentStatus) {
            set({
              status: {
                ...currentStatus,
                hasViewedProductTour: false,
              },
              showTour: true,
            });
          }
          sessionStorage.removeItem('product-tour-dismissed');
        } catch (error) {
          console.error('Failed to reset tour:', error);
        }
      },

      // Reset store
      reset: () => {
        set({
          status: null,
          showWizard: false,
          showTour: false,
          isLoading: false,
        });
        sessionStorage.removeItem('onboarding-wizard-dismissed');
        sessionStorage.removeItem('product-tour-dismissed');
      },
    }),
    {
      name: 'onboarding-storage',
      partialize: (state) => ({
        // Only persist the status, not UI state
        status: state.status,
      }),
    }
  )
);
