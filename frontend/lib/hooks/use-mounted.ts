import { useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

/**
 * Hook to safely track component mount state without triggering
 * cascading renders from setState in useEffect.
 * Uses useSyncExternalStore for hydration-safe mounting detection.
 */
export function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,  // Client: always mounted
    () => false  // Server: never mounted
  );
}
