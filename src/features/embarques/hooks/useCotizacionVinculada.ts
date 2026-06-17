/**
 * Hook de acceso al contexto de cotización vinculada en el wizard de embarque.
 * Separado del Provider para cumplir con react-refresh/only-export-components.
 */
import { useContext } from "react";
import type { CotizacionRow } from "@/features/cotizacion/hooks";
import { CotizacionVinculadaContext } from "../contexts/cotizacionVinculadaContext";

export function useCotizacionVinculada(): CotizacionRow | null {
  return useContext(CotizacionVinculadaContext).cotizacion;
}
