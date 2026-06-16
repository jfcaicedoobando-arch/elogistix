/**
 * Provider de cotización vinculada para detectar campos heredados en el wizard
 * de embarque (Pack B+ v13.33.0).
 *
 * El hook `useCotizacionVinculada` vive en `./useCotizacionVinculada.ts` para
 * cumplir con react-refresh/only-export-components (un archivo = sólo componentes).
 */
import { type ReactNode } from "react";
import type { CotizacionRow } from "@/features/cotizacion/hooks";
import { CotizacionVinculadaContext } from "./cotizacionVinculadaContext";

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
