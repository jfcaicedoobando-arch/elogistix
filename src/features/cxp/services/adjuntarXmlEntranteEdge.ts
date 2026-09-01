/**
 * Ola 5 · O5.8 (BUG-18) — Puente al edge `adjuntar-xml-entrante`.
 *
 * El navegador ya no escribe los metadatos fiscales del CFDI: sólo sube el
 * archivo y pide al servidor que lo verifique. El servidor descarga el XML,
 * revisa el hash, lo re-parsea y guarda SUS valores. Si lo que el navegador
 * leyó no coincide, la operación se rechaza (LC_XML_METADATA_MISMATCH).
 */
import { supabase } from "@/integrations/supabase/client";
import { ensureFreshSession } from "@/lib/auth/ensureFreshSession";
import type { CfdiXmlMeta } from "@/lib/domain/cfdiXmlMeta";

export interface AdjuntarXmlEntranteInput {
  documentoId: string;
  xmlPath: string;
  xmlNombre: string;
  xmlHash: string;
  meta: CfdiXmlMeta | null;
}

/** Traduce los códigos del servidor a mensajes en español para el usuario. */
export function mensajeErrorAdjuntarXml(raw: string): string {
  if (raw.includes("LC_XML_METADATA_MISMATCH")) {
    return "Los datos leídos del XML no coinciden con el archivo que se subió. Vuelve a intentarlo con el XML correcto.";
  }
  if (raw.includes("LC_XML_HASH_MISMATCH")) {
    return "El archivo subido no coincide con el que se estaba validando. Intenta de nuevo.";
  }
  if (raw.includes("LC_XML_INVALIDO") || raw.includes("LC_XML_UUID_INVALIDO")) {
    return "El archivo no es un CFDI 4.0 válido (falta timbre fiscal o está dañado).";
  }
  if (raw.includes("LC_XML_DEMASIADO_GRANDE")) {
    return "El XML excede el tamaño permitido (2 MB).";
  }
  if (raw.includes("permiso de captura CxP")) {
    return "Tu rol no permite adjuntar el XML de este documento. Pide a contabilidad que lo complete.";
  }
  if (raw.includes("LC_FORBIDDEN") || raw.includes("LC_NO_AUTORIZADO")) {
    return "Tu rol no permite adjuntar el XML de este documento.";
  }

  if (raw.includes("LC_ESTADO_INVALIDO")) {
    return "El documento ya fue capturado o no está disponible.";
  }
  return raw;
}

/**
 * Devuelve `null` cuando el XML quedó adjunto, o un error listo para lanzar.
 * Reintenta una vez con la sesión refrescada (mismo criterio que el parseo PDF).
 */
export async function verificarYAdjuntarXmlEntrante(
  input: AdjuntarXmlEntranteInput,
): Promise<{ message: string; details?: string | null } | null> {
  let ultimo = "No se pudo verificar el XML.";
  for (let intento = 1; intento <= 2; intento += 1) {
    const token = await ensureFreshSession(intento > 1);
    if (!token) return { message: "Tu sesión expiró. Inicia sesión de nuevo." };

    const { error } = await supabase.functions.invoke("adjuntar-xml-entrante", {
      headers: { Authorization: `Bearer ${token}` },
      body: {
        documento_id: input.documentoId,
        xml_path: input.xmlPath,
        xml_nombre: input.xmlNombre,
        xml_hash: input.xmlHash,
        declarado: input.meta
          ? {
              uuid: input.meta.uuid,
              rfcEmisor: input.meta.rfcEmisor,
              total: input.meta.total,
              moneda: input.meta.moneda,
            }
          : null,
      },
    });
    if (!error) return null;

    const detalle = await detalleError(error);
    ultimo = detalle;
    // Sólo el 401 amerita reintento con token nuevo; el resto es determinista.
    if (!/401|Token inválido|No autorizado/i.test(detalle)) break;
  }
  return { message: mensajeErrorAdjuntarXml(ultimo) };
}

/** Extrae el mensaje del cuerpo de la respuesta cuando el edge devolvió 4xx. */
async function detalleError(error: unknown): Promise<string> {
  const conContexto = error as { message?: string; context?: { json?: () => Promise<unknown> } };
  try {
    const cuerpo = await conContexto.context?.json?.();
    const msg = (cuerpo as { error?: string } | null)?.error;
    if (typeof msg === "string" && msg) return msg;
  } catch {
    // Respuesta sin JSON: se usa el mensaje genérico del SDK.
  }
  return conContexto.message ?? "No se pudo verificar el XML.";
}
