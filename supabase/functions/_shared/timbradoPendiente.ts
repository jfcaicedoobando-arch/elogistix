/**
 * P0-A/B/C — Timbrado PENDIENTE en FacturAPI 5.0.
 *
 * `invoices.create` puede responder 2xx con `status: "pending"` y SIN UUID
 * cuando el PAC está intermitente: FacturAPI sigue intentando recuperar el
 * timbre hasta ~50 min. Ese documento NO está timbrado, así que el ERP no debe
 * marcarlo como Emitida/Timbrada, ni guardar UUID vacío, ni respaldar XML, ni
 * liberar el claim, ni invitar a reintentar (reintentar duplica el CFDI).
 *
 * Este módulo concentra la detección, los mensajes y la ventana segura de
 * liberación para que factura, nota de crédito y REP se comporten igual.
 */

/** UUID del Timbre Fiscal Digital (32 hex + guiones). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface InvoiceLike {
  id?: string | null;
  uuid?: string | null;
  status?: string | null;
}

/** Estados remotos que NO son timbre final. */
const ESTADOS_NO_TERMINALES = new Set(["pending", "processing", "in_progress"]);

export function uuidFiscalValido(uuid: unknown): boolean {
  return typeof uuid === "string" && UUID_RE.test(uuid.trim());
}

/**
 * `true` si el documento remoto todavía no tiene timbre usable:
 * `status` no terminal o UUID ausente/inválido.
 */
export function esTimbradoPendiente(inv: InvoiceLike | null | undefined): boolean {
  if (!inv) return true;
  const status = (inv.status ?? "").toLowerCase();
  if (ESTADOS_NO_TERMINALES.has(status)) return true;
  return !uuidFiscalValido(inv.uuid);
}

/** `true` sólo si el remoto está timbrado y verificable (`valid` + UUID). */
export function esTimbradoValido(inv: InvoiceLike | null | undefined): boolean {
  if (!inv) return false;
  const status = (inv.status ?? "").toLowerCase();
  // Un remoto sin `status` (listados viejos) se acepta si trae UUID válido.
  if (status && status !== "valid") return false;
  return uuidFiscalValido(inv.uuid);
}

export const MSG_TIMBRADO_PENDIENTE =
  "FacturAPI recibió el documento y está recuperando el timbre del SAT. NO vuelvas a timbrar: el sistema lo verificará automáticamente y lo marcará como emitido en cuanto el SAT responda.";

/** Cuerpo estándar del 202 "timbrado pendiente". */
export function cuerpoTimbradoPendiente(args: {
  pendienteId?: string | null;
  claimTag: string;
  mensaje?: string;
}): Record<string, unknown> {
  return {
    outcome: "timbrado_pendiente",
    pendiente: true,
    // El cliente NO debe reintentar: FacturAPI sigue timbrando.
    reintentable: false,
    facturapi_pendiente_id: args.pendienteId ?? null,
    external_id: args.claimTag,
    message: args.mensaje ?? MSG_TIMBRADO_PENDIENTE,
  };
}

/**
 * P0-B.4 — `idempotency_key_in_use`: FacturAPI ya tiene un intento vivo con esa
 * llave. Nunca es permiso para crear otro CFDI: hay que reconciliar el intento
 * existente.
 */
export function esIdempotencyKeyEnUso(detail: unknown, status?: number): boolean {
  const d = (detail ?? {}) as Record<string, unknown>;
  const texto = `${typeof d.code === "string" ? d.code : ""} ${typeof d.message === "string" ? d.message : ""}`
    .toLowerCase();
  if (texto.includes("idempotency_key_in_use") || texto.includes("idempotency key")) return true;
  return status === 409 && texto.includes("idempotency");
}

export const MSG_IDEMPOTENCY_EN_USO =
  "FacturAPI ya está procesando este mismo documento (llave de idempotencia en uso). NO se creó un CFDI nuevo: usa 'Recuperar timbrado' para sincronizar el intento en curso.";

/**
 * P0-A.5 — Ventana segura de liberación de un claim sin documento remoto.
 * FacturAPI reintenta el timbre hasta ~50 min; liberar a los 3 min podía
 * duplicar el CFDI. La consulta/recuperación puede correr antes, pero la
 * LIBERACIÓN exige superar esta ventana.
 */
export const MIN_EDAD_LIBERACION_MINUTOS = 60;
