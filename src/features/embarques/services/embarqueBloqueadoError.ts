/**
 * EmbarqueBloqueadoError (Fase E, v13.301.74)
 *
 * La RPC `eliminar_embarque_completo` levanta `RAISE EXCEPTION` con:
 *   - MESSAGE: "LC_EMBARQUE_BLOQUEADO: el embarque <exp> tiene dependencias..."
 *   - HINT:    JSON con el desglose de motivos.
 *
 * Este módulo detecta ese contrato en el `PostgrestError` que devuelve
 * Supabase y lo re-emite como una excepción tipada para que la UI pueda
 * abrir `DialogEliminarEmbarqueBloqueado` sin regex ad-hoc.
 */

export interface MotivosBloqueoEmbarque {
  facturas: number;
  cxp: number;
  pagos_cxc: number;
  pagos_cxp: number;
  notas_credito_cxc: number;
  notas_credito_cxp: number;
  comisiones_definitivas: number;
  cerrado: boolean;
  expediente: string;
}

export class EmbarqueBloqueadoError extends Error {
  motivos: MotivosBloqueoEmbarque;

  constructor(motivos: MotivosBloqueoEmbarque) {
    super(
      `El embarque ${motivos.expediente} tiene dependencias fiscales o está cerrado.`,
    );
    this.name = "EmbarqueBloqueadoError";
    this.motivos = motivos;
  }
}

interface PostgrestLike {
  message?: unknown;
  hint?: unknown;
}

function looksLikePostgrest(err: unknown): err is PostgrestLike {
  return typeof err === "object" && err !== null && ("message" in err || "hint" in err);
}

function safeParseMotivos(raw: string): MotivosBloqueoEmbarque | null {
  try {
    // SAFE-CAST: JSON.parse devuelve unknown; validamos shape con runtime checks abajo antes de usarlo.
    const parsed = JSON.parse(raw) as Partial<MotivosBloqueoEmbarque>;
    if (typeof parsed !== "object" || parsed === null) return null;
    if (typeof parsed.expediente !== "string") return null;
    return {
      facturas: Number(parsed.facturas) || 0,
      cxp: Number(parsed.cxp) || 0,
      pagos_cxc: Number(parsed.pagos_cxc) || 0,
      pagos_cxp: Number(parsed.pagos_cxp) || 0,
      notas_credito_cxc: Number(parsed.notas_credito_cxc) || 0,
      notas_credito_cxp: Number(parsed.notas_credito_cxp) || 0,
      comisiones_definitivas: Number(parsed.comisiones_definitivas) || 0,
      cerrado: Boolean(parsed.cerrado),
      expediente: parsed.expediente,
    };
  } catch {
    return null;
  }
}

/**
 * Detecta el marcador `LC_EMBARQUE_BLOQUEADO` en un error de Supabase y
 * devuelve una `EmbarqueBloqueadoError` tipada. Devuelve `null` si no
 * corresponde al contrato (el caller debe re-lanzar el error original).
 */
export function toEmbarqueBloqueadoError(err: unknown): EmbarqueBloqueadoError | null {
  if (!looksLikePostgrest(err)) return null;
  const message = typeof err.message === "string" ? err.message : "";
  if (!message.includes("LC_EMBARQUE_BLOQUEADO")) return null;
  const hint = typeof err.hint === "string" ? err.hint : "";
  const motivos = safeParseMotivos(hint);
  if (!motivos) return null;
  return new EmbarqueBloqueadoError(motivos);
}
