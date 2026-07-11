/**
 * Provider de cotización vinculada para detectar campos heredados en el wizard
 * de embarque (Pack B+ v13.33.0).
 *
 * El hook `useCotizacionVinculada` vive en `./useCotizacionVinculada.ts` para
 * cumplir con react-refresh/only-export-components (un archivo = sólo componentes).
 */
import { useMemo, type ReactNode } from "react";
import type { CotizacionRow } from "@/features/cotizacion/hooks";
import { CotizacionVinculadaContext } from "../contexts/cotizacionVinculadaContext";

interface ProviderProps {
  cotizacion: CotizacionRow | null | undefined;
  children: ReactNode;
}

export function CotizacionVinculadaProvider({ cotizacion, children }: ProviderProps) {
  // Fase 1 audit — memoizar el value evita re-render de todos los consumers
  // cuando el Provider re-renderiza sin cambios en `cotizacion`.
  const value = useMemo(() => ({ cotizacion: cotizacion ?? null }), [cotizacion]);
  return (
    <CotizacionVinculadaContext.Provider value={value}>
      {children}
    </CotizacionVinculadaContext.Provider>
  );
}
