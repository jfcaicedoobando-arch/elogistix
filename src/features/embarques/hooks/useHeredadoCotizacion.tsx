/**
 * Hook + contexto para detectar campos heredados de la cotización vinculada
 * en el wizard de embarque (Pack B+ v13.33.0).
 *
 * Un campo se considera "heredado" cuando:
 *   1. Existe una cotización vinculada.
 *   2. El valor actual del formulario coincide con el valor original que
 *      provenía de la cotización (es decir, el usuario no lo editó).
 *
 * Uso:
 *   ```tsx
 *   <CotizacionVinculadaProvider cotizacion={cotizacionVinculada}>
 *     ...wizard...
 *   </CotizacionVinculadaProvider>
 *
 *   const isHeredado = useHeredadoCotizacion();
 *   isHeredado("descripcionMercancia", cot => cot.descripcion_mercancia);
 *   ```
 */

import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import type { CotizacionRow } from "@/features/cotizacion/hooks";
import type { EmbarqueFormValues } from "@/lib/mappers/embarque";

interface Ctx {
  cotizacion: CotizacionRow | null;
}

const CotizacionVinculadaContext = createContext<Ctx>({ cotizacion: null });

interface ProviderProps {
  cotizacion: CotizacionRow | null | undefined;
  children: ReactNode;
}

export function CotizacionVinculadaProvider({ cotizacion, children }: ProviderProps) {
  return (
    <CotizacionVinculadaContext.Provider value={{ cotizacion: cotizacion ?? null }}>
      {children}
    </CotizacionVinculadaContext.Provider>
  );
}

export function useCotizacionVinculada(): CotizacionRow | null {
  return useContext(CotizacionVinculadaContext).cotizacion;
}

type CotValueGetter = (cot: CotizacionRow) => unknown;

/**
 * Devuelve una función predicado `(field, getter) => boolean` que indica si
 * el valor actual del formulario coincide con el de la cotización heredada.
 */
export function useHeredadoCotizacion() {
  const cot = useCotizacionVinculada();
  const { getValues } = useFormContext<EmbarqueFormValues>();

  return useCallback(
    (field: keyof EmbarqueFormValues, getter: CotValueGetter): boolean => {
      if (!cot) return false;
      const original = getter(cot);
      // Si la cotización no aportó valor para este campo, NO es heredado
      // (evita falsos positivos en campos vacíos en ambos lados).
      if (original === null || original === undefined || original === "") return false;
      const current = getValues(field);
      if (current === null || current === undefined || current === "") return false;
      // Normalizamos a string para comparar booleanos, números y nulls.
      return String(current) === String(original);
    },
    [cot, getValues],
  );
}
