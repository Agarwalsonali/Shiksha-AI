import { useAuthStore } from '@/lib/store/auth.store';

export const useAuth = () => {
  const {
    user,
    profile,
    isAuthenticated,
    isLoading,
    showOnboarding,
    login,
    signup,
    logout,
    checkAuth,
    setUser,
    completeOnboarding,
  } = useAuthStore();

  return {
    user,
    profile,
    isAuthenticated,
    isLoading,
    showOnboarding,
    login,
    signup,
    logout,
    checkAuth,
    setUser,
    completeOnboarding,
  };
};
