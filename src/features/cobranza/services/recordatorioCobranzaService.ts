/**
 * Servicio: envío de recordatorio de cobranza vía edge function
 * `cxc-recordatorio-confirmar`. Extraído para respetar la regla de
 * arquitectura hooks → services → supabase client.
 */
import { supabase } from "@/integrations/supabase/client";
import { parseFunctionError } from "@/features/facturacion/services/facturapiError";
import { z } from "zod";

const DestinatarioSchema = z.object({
  organization_id: z.string().min(1), cliente_id: z.string().min(1),
  contacto_id: z.string().min(1), email: z.string().min(1),
});
const ConsultaSchema = z.object({
  ok: z.literal(true), version: z.literal(2), factura_id: z.string(),
  destinatario: DestinatarioSchema.nullable(),
});
export type DestinatarioConfirmado = z.infer<typeof DestinatarioSchema>;
export type DestinatarioRecordatorio = z.infer<typeof ConsultaSchema>;

export class RevisionDestinatarioError extends Error {
  readonly expected = true;
}

const REVISAR = new Set(['CONFIRMACION_DESTINATARIO_REQUERIDA', 'FACTURA_CAMBIO',
  'CLIENTE_NO_DISPONIBLE', 'CONTACTO_NO_DISPONIBLE', 'DESTINATARIO_CAMBIO']);

async function errorRecordatorio(error: unknown, fallback: string): Promise<Error> {
  const body = await parseFunctionError(error);
  const message = body.error ?? body.message ?? fallback;
  return 'code' in body && typeof body.code === 'string' && REVISAR.has(body.code)
    ? new RevisionDestinatarioError(message) : new Error(message);
}

export interface RecordatorioCobranzaInput {
  facturaId: string;
  nota?: string;
  canal?: "email";
  destinatarioConfirmado: DestinatarioConfirmado;
}

export interface RecordatorioCobranzaResult {
  ok: true;
  enviado_a: string;
}

/** Endpoint separado: consultar nunca puede enviar en un backend antiguo. */
export async function consultarDestinatarioRecordatorio(facturaId: string): Promise<DestinatarioRecordatorio> {
  const { data, error } = await supabase.functions.invoke<DestinatarioRecordatorio>(
    "cxc-recordatorio-destinatario", { body: { factura_id: facturaId } },
  );
  if (error) {
    throw await errorRecordatorio(error, "No se pudo consultar el destinatario.");
  }
  const result = ConsultaSchema.safeParse(data);
  if (!result.success || result.data.factura_id !== facturaId) {
    throw new Error("No se pudo consultar el destinatario.");
  }
  return result.data;
}

export async function enviarRecordatorioCobranza(
  input: RecordatorioCobranzaInput,
): Promise<RecordatorioCobranzaResult> {
  const { data, error } = await supabase.functions.invoke<
    RecordatorioCobranzaResult & { error?: string }
  >("cxc-recordatorio-confirmar", {
    body: {
      factura_id: input.facturaId,
      nota: input.nota,
      canal: input.canal ?? "email",
      confirmacion_version: 2,
      destinatario_confirmado: input.destinatarioConfirmado,
    },
  });
  if (error) {
    // A-3: `functions.invoke` sólo deja "non-2xx status code" en `error.message`
    // y el motivo real (ej. destinatario fuera de los contactos del cliente)
    // en el body. Reusamos `parseFunctionError` para mostrarlo tal cual.
    throw await errorRecordatorio(error, error.message ?? "No se pudo enviar el recordatorio.");
  }
  if (!data?.ok || !data.enviado_a) {
    throw new Error("No se pudo enviar el recordatorio.");
  }
  if (data.enviado_a !== input.destinatarioConfirmado.email) {
    throw new Error("No se pudo confirmar el destinatario del envío. Revisa el historial antes de reintentar.");
  }
  return data;
}
