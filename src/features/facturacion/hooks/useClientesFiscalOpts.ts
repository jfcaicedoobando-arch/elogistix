import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query";

export interface ClienteFiscalOpt {
  id: string;
  nombre: string;
  rfc: string | null;
  codigo_postal: string | null;
  regimen_fiscal: string | null;
  uso_cfdi_default: string | null;
  dias_credito: number | null;
  limite_credito_mxn: number | null;
}

/**
 * Catálogo (hasta 2000) de clientes con datos fiscales, usado por los diálogos
 * de facturación manual. Se separa del diálogo para mantenerlo bajo el límite
 * de 200 líneas (Power of 10 #1).
 */
export function useClientesFiscalOpts(organizationId: string | null, enabled: boolean) {
  return useQuery<ClienteFiscalOpt[]>({
    queryKey: queryKeys.facturacion.clientesFiscalOpts(organizationId),
    enabled: enabled && !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nombre, rfc, codigo_postal, regimen_fiscal, uso_cfdi_default, dias_credito, limite_credito_mxn")
        .order("nombre")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as ClienteFiscalOpt[];
    },
  });
}
