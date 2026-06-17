/**
 * Contexto puro (sin componentes) para cotización vinculada en wizard de embarque.
 * Separado para cumplir con react-refresh/only-export-components.
 */
import { createContext } from "react";
import type { CotizacionRow } from "@/features/cotizacion/hooks";

export interface CotizacionVinculadaCtx {
  cotizacion: CotizacionRow | null;
}

export const CotizacionVinculadaContext = createContext<CotizacionVinculadaCtx>({
  cotizacion: null,
});
