import { useEffect, useState } from "react";

// Rupture mobile/desktop (épopée #70) : sous ce seuil → coquille mobile à onglets,
// au-dessus → layout desktop. L'iPad suit son orientation : portrait (~810 px) passe
// sous le seuil, paysage (~1080 px) au-dessus.
export const MOBILE_BREAKPOINT = 900;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}
