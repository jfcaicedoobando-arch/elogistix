/**
 * `useIsMobile` — thin wrapper sobre `usehooks-ts` (npm).
 * Breakpoint: 768px (Tailwind `md`). Firma histórica: `() => boolean`.
 * Lote 9a — DRY vs npm.
 */
import { useMediaQuery } from "usehooks-ts";

export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)", { initializeWithValue: false });
}
