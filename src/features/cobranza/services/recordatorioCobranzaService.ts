/**
 * Servicio: envío de recordatorio de cobranza vía edge function
 * `cxc-recordatorio-enviar`. Extraído para respetar la regla de
 * arquitectura hooks → services → supabase client.
 */
import { supabase } from "@/integrations/supabase/client";
import { parseFunctionError } from "@/features/facturacion/services/facturapiError";

export interface RecordatorioCobranzaInput {
  facturaId: string;
  nota?: string;
  canal?: "email";
  contactoEmail?: string | null;
}

export interface RecordatorioCobranzaResult {
  ok: true;
  enviado_a: string;
}

export async function enviarRecordatorioCobranza(
  input: RecordatorioCobranzaInput,
): Promise<RecordatorioCobranzaResult> {
  const { data, error } = await supabase.functions.invoke<
    RecordatorioCobranzaResult & { error?: string }
  >("cxc-recordatorio-enviar", {
    body: {
      factura_id: input.facturaId,
      nota: input.nota,
      canal: input.canal ?? "email",
      contacto_email: input.contactoEmail,
    },
  });
  if (error) {
    // A-3: `functions.invoke` sólo deja "non-2xx status code" en `error.message`
    // y el motivo real (ej. destinatario fuera de los contactos del cliente)
    // en el body. Reusamos `parseFunctionError` para mostrarlo tal cual.
    const body = await parseFunctionError(error);
    throw new Error(body.error ?? body.message ?? error.message);
  }
  if (!data?.ok || !data.enviado_a) {
    throw new Error("No se pudo enviar el recordatorio.");
  }
  return data;
}
