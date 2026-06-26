/**
 * Servicio para enviar el CFDI (factura o REP) por email vía FacturApi.
 * Invoca la edge function `facturapi-enviar-email`.
 */
import { supabase } from "@/integrations/supabase/client";

export interface EnviarCfdiResult {
  ok: true;
  enviado_a: string;
}

interface EnviarCfdiArgs {
  facturaId?: string;
  pagoId?: string;
  email?: string;
}

async function invocar(args: EnviarCfdiArgs): Promise<EnviarCfdiResult> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    enviado_a?: string;
    message?: string;
    error?: string;
  }>("facturapi-enviar-email", {
    body: {
      factura_id: args.facturaId,
      pago_id: args.pagoId,
      email: args.email,
    },
  });
  if (error) throw new Error(error.message);
  if (!data?.ok || !data.enviado_a) {
    throw new Error(data?.message ?? data?.error ?? "No se pudo enviar el CFDI.");
  }
  return { ok: true, enviado_a: data.enviado_a };
}

export function enviarCfdiFactura(facturaId: string, email?: string): Promise<EnviarCfdiResult> {
  return invocar({ facturaId, email });
}

export function enviarCfdiRep(pagoId: string, email?: string): Promise<EnviarCfdiResult> {
  return invocar({ pagoId, email });
}
