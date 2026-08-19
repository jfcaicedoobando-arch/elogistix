import { supabase } from "@/integrations/supabase/client";
import { CAP_REPORTE } from "@/constants/queryCaps";

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

/** Catálogo (hasta 2000) de clientes con datos fiscales para diálogos de facturación. */
export async function fetchClientesFiscalOpts(): Promise<ClienteFiscalOpt[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nombre, rfc, codigo_postal, regimen_fiscal, uso_cfdi_default, dias_credito, limite_credito_mxn")
    .order("nombre")
    .limit(CAP_REPORTE);
  if (error) throw error;
  return (data ?? []) as ClienteFiscalOpt[];
}
