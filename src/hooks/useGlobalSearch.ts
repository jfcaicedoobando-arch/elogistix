import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GlobalSearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type: "embarque" | "cliente" | "proveedor" | "factura" | "cotizacion";
  url: string;
}

interface RpcRow {
  id: string;
  label: string;
  sublabel: string;
  tipo: string;
  url: string;
}

/**
 * Hook para búsqueda global vía RPC `busqueda_global`.
 * Aísla el acceso a Supabase del componente UI.
 */
export function useGlobalSearch() {
  return useCallback(async (termino: string, limite = 5): Promise<GlobalSearchResult[]> => {
    if (!termino.trim()) return [];
    const { data, error } = await supabase.rpc("busqueda_global", { termino, limite });
    if (error) {
      console.error("Error en búsqueda global:", error);
      return [];
    }
    return (data ?? []).map((r: RpcRow) => ({
      id: r.id,
      label: r.label,
      sublabel: r.sublabel,
      type: r.tipo as GlobalSearchResult["type"],
      url: r.url,
    }));
  }, []);
}
