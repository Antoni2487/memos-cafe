import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

// Breakpoints alineados a Tailwind v4 por defecto
export const useIsMobile = (): boolean => useMediaQuery("(max-width: 767px)");
export const useIsTablet = (): boolean => useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
