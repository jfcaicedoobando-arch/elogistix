/**
 * v13.819.2 — Ubicación del duplicado del buzón CxP.
 *
 * Antes, al subir desde Costos de un embarque un archivo ya capturado, el
 * operador sólo leía "búscala en Compras › Facturas" — una sección que su rol
 * puede no tener. Ahora el backend (RPC `buzon_localizar_duplicado`) dice
 * DÓNDE está el documento y la UI puede ofrecer "Ver embarque".
 *
 * El aislamiento multi-org lo garantiza la RPC: para duplicados ajenos
 * devuelve `caso = 'ajeno'` sin ids ni folio.
 */
import { supabase } from "@/integrations/supabase/client";

export type CasoDuplicadoBuzon =
  | "buzon_pendiente"
  | "mismo_embarque"
  | "otro_embarque"
  | "sin_embarque"
  | "ajeno";

export interface UbicacionDuplicadoBuzon {
  caso: CasoDuplicadoBuzon;
  facturaId: string | null;
  embarqueId: string | null;
  embarqueExpediente: string | null;
}

/** Código estable del conflicto (409) para el contrato con la UI. */
export const CODIGO_BUZON_DUPLICADO = "BUZON_FACTURA_DUPLICADA" as const;

/**
 * Error de validación ESPERADA del buzón (documento duplicado). Se marca con
 * `expected = true` para que el aviso llegue al usuario pero no a Sentry.
 */
export class BuzonDuplicadoError extends Error {
  readonly expected = true;
  readonly code = CODIGO_BUZON_DUPLICADO;
  readonly status = 409;
  readonly ubicacion: UbicacionDuplicadoBuzon;
  constructor(message: string, ubicacion: UbicacionDuplicadoBuzon) {
    super(message);
    this.name = "BuzonDuplicadoError";
    this.ubicacion = ubicacion;
  }
}

const MENSAJE_GENERICO =
  "Esta factura ya está registrada. Solicita a Operaciones que revise el documento.";

/** Mensaje accionable según dónde quedó el documento duplicado. */
export function mensajeDuplicadoBuzon(
  ubicacion: UbicacionDuplicadoBuzon,
  esXml: boolean,
): string {
  const que = esXml ? "Este XML" : "Este archivo";
  switch (ubicacion.caso) {
    case "buzon_pendiente":
      return `${que} ya está en el buzón esperando captura. Abre el documento existente en vez de subirlo otra vez.`;
    case "mismo_embarque":
      return "Esta factura ya está registrada en este embarque.";
    case "otro_embarque":
      return ubicacion.embarqueExpediente
        ? `Esta factura ya está registrada en el embarque ${ubicacion.embarqueExpediente}.`
        : MENSAJE_GENERICO;
    case "sin_embarque":
      return "Esta factura ya está registrada en Compras, pero todavía no está vinculada a un embarque.";
    default:
      return MENSAJE_GENERICO;
  }
}

/**
 * Consulta la RPC canónica. Fail-open a propósito (igual que el dedupe
 * anterior): si la consulta falla no se bloquea la subida; el índice único de
 * la BD sigue siendo la última línea de defensa.
 */
export async function localizarDuplicadoBuzon(params: {
  hash: string;
  columna: "archivo_hash" | "xml_hash";
  uuidFiscal?: string | null;
  embarqueId?: string | null;
}): Promise<UbicacionDuplicadoBuzon | null> {
  const { data, error } = await supabase.rpc("buzon_localizar_duplicado", {
    p_hash: params.hash,
    p_columna: params.columna,
    p_uuid_fiscal: params.uuidFiscal ?? null,
    p_embarque_id: params.embarqueId ?? null,
  });
  if (error) return null;
  const fila = (data ?? [])[0];
  if (!fila?.caso) return null;
  return {
    caso: fila.caso as CasoDuplicadoBuzon,
    facturaId: fila.factura_id ?? null,
    embarqueId: fila.embarque_id ?? null,
    embarqueExpediente: fila.embarque_expediente ?? null,
  };
}
