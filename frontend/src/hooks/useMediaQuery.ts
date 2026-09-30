import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

// Breakpoints alineados a Tailwind v4 por defecto
export const useIsMobile = (): boolean => useMediaQuery("(max-width: 767px)");
export const useIsTablet = (): boolean => useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
