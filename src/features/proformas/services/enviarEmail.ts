/**
 * Envío de proforma por email vía Edge Function `enviar-proforma-email`.
 * Extraído de `EnviarProformaDialog.tsx` (Block 1.6) para respetar la capa
 * componente → service → supabase.
 */
import { supabase } from "@/integrations/supabase/client";

export interface EnviarProformaEmailInput {
  proformaId: string;
  destinatarios: { email: string }[];
  cc: string[];
  asunto: string;
  mensaje: string;
}

export interface EnviarProformaEmailResult {
  enlace_portal: string;
  estado: string;
}

interface EdgeResponse {
  success: boolean;
  enlace_portal: string;
  estado: string;
  error?: string;
}

export async function enviarProformaPorEmail(
  input: EnviarProformaEmailInput,
): Promise<EnviarProformaEmailResult> {
  const { data, error } = await supabase.functions.invoke<EdgeResponse>(
    "enviar-proforma-email",
    {
      body: {
        proforma_id: input.proformaId,
        destinatarios: input.destinatarios,
        cc: input.cc,
        asunto: input.asunto,
        mensaje: input.mensaje,
      },
    },
  );
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? "El envío no se completó.");
  return { enlace_portal: data.enlace_portal, estado: data.estado };
}
