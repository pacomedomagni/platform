/**
 * Cart State Management using Zustand
 * Persists cart to localStorage and syncs with API
 */
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { cartApi, Cart, CartItem } from './store-api';

/** Cart item with display-friendly properties */
export interface CartItemDisplay extends CartItem {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  variant?: string;
}

interface CartState {
  // State
  cartId: string | null;
  sessionToken: string | null;
  items: CartItemDisplay[];
  itemCount: number;
  subtotal: number;
  shippingTotal: number;
  taxTotal: number;
  discountAmount: number;
  grandTotal: number;
  couponCode: string | null;
  isLoading: boolean;
  error: string | null;

  // Aliases for backward compatibility
  shipping: number;
  tax: number;
  discount: number;
  total: number;

  // Actions
  initCart: () => Promise<void>;
  initializeCart: () => Promise<void>; // Alias for initCart
  addItem: (productId: string, quantity?: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  clearCart: () => Promise<void>;
  syncCart: () => Promise<void>;
  setCartFromApi: (cart: Cart) => void;
}

// Generate session token for anonymous carts
function generateSessionToken(): string {
  return 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // Initial state
      cartId: null,
      sessionToken: null,
      items: [],
      itemCount: 0,
      subtotal: 0,
      shippingTotal: 0,
      taxTotal: 0,
      discountAmount: 0,
      grandTotal: 0,
      couponCode: null,
      isLoading: false,
      error: null,

      // Computed aliases (getters via get())
      get shipping() { return get().shippingTotal; },
      get tax() { return get().taxTotal; },
      get discount() { return get().discountAmount; },
      get total() { return get().grandTotal; },

      // initializeCart alias
      initializeCart: async () => get().initCart(),

      // Set cart from API response
      setCartFromApi: (cart: Cart) => {
        // Map items with convenience aliases including slug for product links
        const mappedItems = cart.items.map(item => ({
          ...item,
          productId: item.product.id,
          slug: item.product.slug,
          name: item.product.displayName,
          price: item.product.price,
          image: item.product.images[0] || '',
          variant: undefined,
        }));

        set({
          cartId: cart.id,
          items: mappedItems,
          itemCount: cart.itemCount,
          subtotal: cart.subtotal,
          shippingTotal: cart.shippingTotal,
          taxTotal: cart.taxTotal,
          discountAmount: cart.discountAmount,
          grandTotal: cart.grandTotal,
          couponCode: cart.couponCode,
          error: null,
        });
      },

      // Initialize cart (get existing or create new)
      initCart: async () => {
        const { cartId, sessionToken } = get();
        
        // Ensure session token exists
        if (!sessionToken) {
          const newToken = generateSessionToken();
          set({ sessionToken: newToken });
          localStorage.setItem('cart_session', newToken);
        }

        set({ isLoading: true, error: null });

        try {
          if (cartId) {
            // Try to fetch existing cart
            const cart = await cartApi.getById(cartId);
            get().setCartFromApi(cart);
          } else {
            // Get or create cart
            const cart = await cartApi.get();
            get().setCartFromApi(cart);
          }
        } catch (error) {
          console.error('Failed to init cart:', error);
          // Cart might not exist, will be created on first add
          set({ error: null });
        } finally {
          set({ isLoading: false });
        }
      },

      // Add item to cart
      addItem: async (productId: string, quantity = 1) => {
        set({ isLoading: true, error: null });

        try {
          let { cartId } = get();

          // Create cart if needed
          if (!cartId) {
            const cart = await cartApi.get();
            cartId = cart.id;
            set({ cartId });
          }

          const cart = await cartApi.addItem(cartId, productId, quantity);
          get().setCartFromApi(cart);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to add item';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // Update item quantity
      updateItem: async (itemId: string, quantity: number) => {
        const { cartId } = get();
        if (!cartId) return;

        set({ isLoading: true, error: null });

        try {
          if (quantity <= 0) {
            await get().removeItem(itemId);
            return;
          }

          const cart = await cartApi.updateItem(cartId, itemId, quantity);
          get().setCartFromApi(cart);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update item';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // Remove item from cart
      removeItem: async (itemId: string) => {
        const { cartId } = get();
        if (!cartId) return;

        set({ isLoading: true, error: null });

        try {
          const cart = await cartApi.removeItem(cartId, itemId);
          get().setCartFromApi(cart);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to remove item';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // Apply coupon code
      applyCoupon: async (code: string) => {
        const { cartId } = get();
        if (!cartId) return;

        set({ isLoading: true, error: null });

        try {
          const cart = await cartApi.applyCoupon(cartId, code);
          get().setCartFromApi(cart);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid coupon code';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // Remove coupon
      removeCoupon: async () => {
        const { cartId } = get();
        if (!cartId) return;

        set({ isLoading: true, error: null });

        try {
          const cart = await cartApi.removeCoupon(cartId);
          get().setCartFromApi(cart);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to remove coupon';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // Clear entire cart
      clearCart: async () => {
        const { cartId } = get();
        if (!cartId) return;

        set({ isLoading: true, error: null });

        try {
          await cartApi.clear(cartId);
          set({
            cartId: null,
            items: [],
            itemCount: 0,
            subtotal: 0,
            shippingTotal: 0,
            taxTotal: 0,
            discountAmount: 0,
            grandTotal: 0,
            couponCode: null,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to clear cart';
          set({ error: message });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      // Sync cart with server
      syncCart: async () => {
        const { cartId } = get();
        if (!cartId) return;

        try {
          const cart = await cartApi.getById(cartId);
          get().setCartFromApi(cart);
        } catch (error) {
          console.error('Failed to sync cart:', error);
        }
      },
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({
        cartId: state.cartId,
        sessionToken: state.sessionToken,
      }),
    }
  )
);

// Hook for cart initialization on mount
export function useInitCart() {
  const initCart = useCartStore((state) => state.initCart);
  
  // Only run on client
  if (typeof window !== 'undefined') {
    // Set session token header for API calls
    const sessionToken = useCartStore.getState().sessionToken;
    if (sessionToken) {
      localStorage.setItem('cart_session', sessionToken);
    }
  }

  return initCart;
}
