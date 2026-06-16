/**
 * Servicio: envío de cotización por correo.
 *
 * Flujo:
 *  1. `prepare` → obtiene signed upload URL para el PDF.
 *  2. Genera el PDF como blob en cliente con la plantilla existente.
 *  3. Sube el PDF al bucket privado vía signed upload URL.
 *  4. `send` → invoca la edge function que dispara los correos y registra el envío.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CotizacionRow } from "@/features/cotizacion/types";
import { TASA_IVA } from "@/lib/financial/financialUtils";

export interface DestinatarioEnvio {
  email: string;
  nombre?: string;
  contacto_id?: string;
}

export interface EnviarEmailInput {
  cotizacion: CotizacionRow;
  destinatarios: DestinatarioEnvio[];
  cc: string[];
  mensaje: string;
  asunto: string;
  marcarEnviada: boolean;
  totales: { mxn?: string; usd?: string };
  ejecutivo: { nombre?: string; email?: string; telefono?: string };
  tasaIva?: number;
}

export interface EnviarEmailResult {
  success: boolean;
  estado: "enviado" | "parcial" | "fallido";
  envio_id: string | null;
  resultados: Array<{ email: string; tipo: string; ok: boolean; error?: string }>;
  pdf_link: string;
}

async function generarPdfBlob(cotizacion: CotizacionRow, tasaIva: number): Promise<Blob> {
  // Reusa la misma plantilla que el botón "Exportar PDF".
  const { CotizacionDocument } = await import("@/pdf/documents/CotizacionDocument");
  const { cargarEmisorEmpresa } = await import("@/pdf/emisor");
  const { pdf } = await import("@react-pdf/renderer");
  const emisor = await cargarEmisorEmpresa();
  const instance = pdf(<CotizacionDocument cotizacion={cotizacion} tasaIva={tasaIva} emisor={emisor} />);
  return await instance.toBlob();
}

export async function enviarCotizacionPorEmail(input: EnviarEmailInput): Promise<EnviarEmailResult> {
  const { cotizacion, tasaIva = TASA_IVA } = input;

  // 1. prepare → signed upload URL
  const { data: prep, error: prepErr } = await supabase.functions.invoke("enviar-cotizacion-email", {
    body: { action: "prepare", cotizacion_id: cotizacion.id },
  });
  if (prepErr) throw new Error(prepErr.message);
  if (!prep?.upload_token || !prep?.path) {
    throw new Error(prep?.error ?? "No se pudo preparar la subida del PDF");
  }

  // 2. Generar PDF
  const blob = await generarPdfBlob(cotizacion, tasaIva);

  // 3. Subir con signed upload URL
  const { error: uploadErr } = await supabase
    .storage.from("cotizaciones-pdf")
    .uploadToSignedUrl(prep.path, prep.upload_token, blob, { contentType: "application/pdf" });
  if (uploadErr) throw new Error(`Subida de PDF falló: ${uploadErr.message}`);

  // 4. send
  const { data: send, error: sendErr } = await supabase.functions.invoke("enviar-cotizacion-email", {
    body: {
      action: "send",
      cotizacion_id: cotizacion.id,
      destinatarios: input.destinatarios,
      cc: input.cc,
      mensaje: input.mensaje,
      asunto: input.asunto,
      marcar_enviada: input.marcarEnviada,
      pdf_path: prep.path,
      totales: input.totales,
      ejecutivo: input.ejecutivo,
    },
  });
  if (sendErr) throw new Error(sendErr.message);
  if (!send) throw new Error("Respuesta vacía del servidor");
  if (send.error) throw new Error(send.error);
  return send as EnviarEmailResult;
}
