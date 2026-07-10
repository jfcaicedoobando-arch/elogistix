/**
 * `useDebouncedValue` — thin wrapper sobre `use-debounce` (npm).
 * Se mantiene la firma histórica `(value, delay=300) => debouncedValue`
 * para no tocar los ~40 call-sites del proyecto.
 * Lote 9a — DRY vs npm.
 */
import { useDebounce as useDebouncedFromLib } from "use-debounce";

export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debounced] = useDebouncedFromLib(value, delay);
  return debounced;
}
