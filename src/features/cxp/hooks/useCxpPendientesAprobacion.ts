/**
 * Cuenta de facturas de proveedor pendientes de aprobación para la organización
 * del usuario actual. Usado para el badge del sidebar en el módulo Compras.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCxpPendientesAprobacion() {
  return useQuery({
    queryKey: ["cxp", "pendientes-aprobacion-count"] as const,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("cxp_pendientes_aprobacion_count");
      if (error) throw error;
      return Number(data ?? 0);
    },
    staleTime: 60_000,
  });
}
