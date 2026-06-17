/**
 * Helpers puros para facturapi-cancelar.
 * Sin I/O, sin Deno, sin Supabase. 100% testeables con Deno.test.
 */

export const MOTIVOS_VALIDOS = new Set(["01", "02", "03", "04"]);

export interface CancelacionInput {
  factura_id?: string;
  motivo?: string;
  sustituye_uuid?: string;
}

export type CancelacionValidacion =
  | { ok: true; data: { factura_id: string; motivo: string; sustituye_uuid?: string } }
  | { ok: false; error: string; message?: string };

/**
 * Valida el payload de cancelación según reglas SAT.
 * Motivos válidos: 01, 02, 03, 04. Motivo 01 requiere `sustituye_uuid`.
 */
export function validateCancelacionInput(body: CancelacionInput): CancelacionValidacion {
  if (!body.factura_id) {
    return { ok: false, error: "factura_id_required" };
  }
  if (!body.motivo || !MOTIVOS_VALIDOS.has(body.motivo)) {
    return { ok: false, error: "motivo_invalido", message: "Motivo SAT requerido (01-04)" };
  }
  if (body.motivo === "01" && !body.sustituye_uuid) {
    return { ok: false, error: "sustituye_uuid_requerido", message: "Motivo 01 requiere UUID que sustituye" };
  }
  return {
    ok: true,
    data: {
      factura_id: body.factura_id,
      motivo: body.motivo,
      sustituye_uuid: body.sustituye_uuid,
    },
  };
}

/**
 * Construye el query string para la API de Facturapi DELETE /invoices/:id.
 * `motive` siempre; `substitution` sólo si hay UUID que sustituye.
 */
export function buildCancelQuery(motivo: string, sustituyeUuid?: string): string {
  const params = new URLSearchParams({ motive: motivo });
  if (sustituyeUuid) params.set("substitution", sustituyeUuid);
  return params.toString();
}
