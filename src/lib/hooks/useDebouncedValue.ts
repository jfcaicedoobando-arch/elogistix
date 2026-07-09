/**
 * Hook canónico para debouncing de valores.
 *
 * DRY (Lote 7e · DRY-7): fuente única para cualquier `useEffect + setTimeout`
 * repetido en el codebase. Reemplaza el patrón `[state, setState]` +
 * `setTimeout` inline y también el `useDebounce` histórico de `@/hooks/shared`
 * (que ahora es un re-export de este módulo).
 *
 * @param value  Valor a debouncear.
 * @param delay  Retraso en ms antes de propagar el último valor (default 300).
 * @returns      El último valor estable después de `delay` ms sin cambios.
 */
import { useState, useEffect } from "react";

export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
