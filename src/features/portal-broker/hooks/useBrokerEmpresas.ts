import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { agruparEmpresas, type FilaBrokerEmpresa } from "../domain/agruparEmpresas";

/** Empresas del broker con la etapa actual de sus oportunidades. */
export function useBrokerEmpresas() {
  return useQuery({
    queryKey: ["broker", "mis-empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("broker_mis_empresas");
      if (error) throw error;
      return agruparEmpresas((data ?? []) as FilaBrokerEmpresa[]);
    },
    refetchInterval: 60_000,
  });
}
