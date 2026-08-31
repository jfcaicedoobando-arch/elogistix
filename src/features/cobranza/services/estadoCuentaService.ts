/**
 * Servicio: envío de estado de cuenta por email vía edge function.
 * Extraído de useEstadoCuentaEmail para respetar la jerarquía
 * hooks → services → supabase client.
 */
import { supabase } from "@/integrations/supabase/client";
import { parseFunctionError } from "@/features/facturacion/services/facturapiError";

export interface EnviarEstadoCuentaInput {
  clienteId: string;
  periodo?: string;
  contactoEmail?: string;
  mensaje?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

export interface EnviarEstadoCuentaResult {
  ok: boolean;
  enviado_a?: string;
}

export async function enviarEstadoCuentaEmail(
  input: EnviarEstadoCuentaInput,
): Promise<EnviarEstadoCuentaResult> {
  const { data, error } = await supabase.functions.invoke<EnviarEstadoCuentaResult>(
    "cxc-estado-cuenta-enviar",
    {
      body: {
        cliente_id: input.clienteId,
        periodo: input.periodo ?? null,
        contacto_email: input.contactoEmail?.trim() ?? null,
        mensaje: input.mensaje?.trim() ?? null,
        fecha_desde: input.fechaDesde ?? null,
        fecha_hasta: input.fechaHasta ?? null,
      },
    },
  );
  if (error) {
    // Ola v16 (5): `functions.invoke` deja sólo "non-2xx status code" en
    // `error.message`; el motivo real (cliente sin contactos, periodo sin
    // movimientos) viaja en el body. Mismo canon que recordatorioCobranzaService.
    const body = await parseFunctionError(error);
    throw new Error(body.error ?? body.message ?? error.message);
  }
  if (!data?.ok) throw new Error("No se pudo enviar el estado de cuenta");
  return data;
}
