import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, type AuthResponse } from '@/lib/api/auth.api';
import type { User, UserProfile } from '@/lib/types/user.types';
import { toast } from 'sonner';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  showOnboarding: boolean;
  
  login: (email: string, password: string) => Promise<void>;
  signup: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUser: (user: User, profile: UserProfile) => void;
  completeOnboarding: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      showOnboarding: true,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const response = await authApi.login({ email, password });
          if (!response.session) {
            throw new Error('Login did not return an active session');
          }
          if (typeof window !== 'undefined') {
            localStorage.setItem('token', response.session.access_token);
          }
          set({
            user: response.user,
            profile: response.profile,
            token: response.session.access_token,
            isAuthenticated: true,
            showOnboarding: false, // Existing users skip onboarding
          });
          toast.success('Welcome back!');
        } catch (error) {
          set({ isAuthenticated: false });
          // Error toast already shown by API client
          console.error('Login error:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      signup: async (data) => {
        set({ isLoading: true });
        try {
          const response = await authApi.signup(data);
          if (response.session && typeof window !== 'undefined') {
            localStorage.setItem('token', response.session.access_token);
          }
          set({
            user: response.user,
            profile: response.profile,
            token: response.session?.access_token ?? null,
            isAuthenticated: response.session !== null,
            showOnboarding: true, // New users see onboarding
          });
          toast.success('Account created successfully!');
        } catch (error) {
          set({ isAuthenticated: false });
          // Error toast already shown by API client
          console.error('Signup error:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch (error) {
          // Continue with logout even if API call fails
        } finally {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
          }
          set({
            user: null,
            profile: null,
            token: null,
            isAuthenticated: false,
            showOnboarding: true,
          });
          toast.success('Logged out successfully');
        }
      },

      checkAuth: async () => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) {
          set({ isAuthenticated: false, isLoading: false });
          return;
        }

        // If we already have user data, don't refetch
        const state = get();
        if (state.user && state.isAuthenticated) {
          set({ isLoading: false });
          return;
        }

        set({ isLoading: true });
        try {
          const data = await authApi.me();
          set({
            user: data.user,
            profile: data.profile,
            token,
            isAuthenticated: true,
          });
        } catch (error) {
          // Only clear auth on actual auth failures (401), not on other errors
          const errorMessage = error instanceof Error ? error.message : '';
          const isRateLimited = errorMessage.includes('Too many requests');
          const isNetworkError = errorMessage.includes('Network error');
          const isValidationError = errorMessage.includes('Validation');
          const isTimeout = errorMessage.includes('timed out') || errorMessage.includes('timeout');
          const isAuthError = errorMessage.includes('Unauthorized') || 
                              errorMessage.includes('Invalid token') ||
                              errorMessage.includes('Token expired');
          
          // Only logout on actual auth errors (not rate limits, network issues, timeouts, or validation)
          if (isAuthError && !isRateLimited && !isNetworkError && !isValidationError && !isTimeout) {
            if (typeof window !== 'undefined') {
              localStorage.removeItem('token');
            }
            set({ 
              isAuthenticated: false,
              user: null,
              profile: null,
              token: null,
            });
          }
        } finally {
          set({ isLoading: false });
        }
      },

      setUser: (user, profile) => set({ user, profile }),

      completeOnboarding: () => set({ showOnboarding: false }),
    }),
    {
      name: 'shiksha-auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        profile: state.profile,
        isAuthenticated: state.isAuthenticated,
        showOnboarding: state.showOnboarding,
      }),
    }
  )
);
