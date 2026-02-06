/**
 * Customer Auth State Management
 */
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, Customer, CustomerAddress } from './store-api';

interface AuthState {
  // State
  customer: Customer | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  addresses: CustomerAddress[];

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    acceptsMarketing?: boolean;
  }) => Promise<void>;
  logout: () => void;
  loadProfile: () => Promise<void>;
  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    acceptsMarketing?: boolean;
  }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  loadAddresses: () => Promise<void>;
  addAddress: (address: Omit<CustomerAddress, 'id'>) => Promise<CustomerAddress>;
  updateAddress: (id: string, address: Partial<CustomerAddress>) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      customer: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      addresses: [],

      // Login
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authApi.login(email, password);
          localStorage.setItem('customer_token', response.token);
          set({
            customer: response.customer,
            token: response.token,
            isAuthenticated: true,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // Register
      register: async (data) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authApi.register(data);
          localStorage.setItem('customer_token', response.token);
          set({
            customer: response.customer,
            token: response.token,
            isAuthenticated: true,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Registration failed';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // Logout
      logout: () => {
        localStorage.removeItem('customer_token');
        set({
          customer: null,
          token: null,
          isAuthenticated: false,
          addresses: [],
        });
      },

      // Load profile
      loadProfile: async () => {
        const { token } = get();
        if (!token) return;

        set({ isLoading: true, error: null });

        try {
          const customer = await authApi.getProfile();
          set({ customer, isAuthenticated: true });
        } catch {
          // Token invalid, logout
          get().logout();
        } finally {
          set({ isLoading: false });
        }
      },

      // Update profile
      updateProfile: async (data) => {
        set({ isLoading: true, error: null });

        try {
          const customer = await authApi.updateProfile(data);
          set({ customer });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Update failed';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // Change password
      changePassword: async (currentPassword: string, newPassword: string) => {
        set({ isLoading: true, error: null });

        try {
          await authApi.changePassword(currentPassword, newPassword);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Password change failed';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // Forgot password
      forgotPassword: async (email: string) => {
        set({ isLoading: true, error: null });

        try {
          await authApi.forgotPassword(email);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Request failed';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // Reset password
      resetPassword: async (token: string, password: string) => {
        set({ isLoading: true, error: null });

        try {
          await authApi.resetPassword(token, password);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Reset failed';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // Load addresses
      loadAddresses: async () => {
        set({ isLoading: true, error: null });

        try {
          const addresses = await authApi.getAddresses();
          set({ addresses });
        } catch (error) {
          console.error('Failed to load addresses:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      // Add address
      addAddress: async (address) => {
        set({ isLoading: true, error: null });

        try {
          const newAddress = await authApi.addAddress(address);
          set((state) => ({ addresses: [...state.addresses, newAddress] }));
          return newAddress;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to add address';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // Update address
      updateAddress: async (id: string, address) => {
        set({ isLoading: true, error: null });

        try {
          const updated = await authApi.updateAddress(id, address);
          set((state) => ({
            addresses: state.addresses.map((a) => (a.id === id ? updated : a)),
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update address';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // Delete address
      deleteAddress: async (id: string) => {
        set({ isLoading: true, error: null });

        try {
          await authApi.deleteAddress(id);
          set((state) => ({
            addresses: state.addresses.filter((a) => a.id !== id),
          }));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to delete address';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        customer: state.customer,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
