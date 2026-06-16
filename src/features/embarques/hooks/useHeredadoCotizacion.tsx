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

