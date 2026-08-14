/**
 * Interpreta el error que devuelven las Edge Functions de facturación
 * (`{ error, status, detail }`, donde `detail` viene de
 * `describeFacturapiError()` en el backend) y lo convierte en un mensaje de
 * negocio en es-MX + detalles copiables para soporte.
 *
 * v13.615.0 (Ola 17).
 */
import { buscarCodigoSat, extraerCodigoSatDeTexto } from "./satErrorCodes";

interface FacturapiDetail {
  message?: unknown;
  code?: unknown;
  path?: unknown;
  location?: unknown;
  errors?: unknown;
  logId?: unknown;
}

export interface FacturapiErrorInterpretado {
  /** Título corto para el toast (nunca técnico). */
  titulo: string;
  /** Acción sugerida o mensaje original saneado. */
  descripcion: string;
  /** Código reconocido (SAT o FacturApi), si lo hubo. */
  codigo: string | null;
  /** Detalles técnicos para `context` de `notifyError` → "Ver detalles". */
  detalles: Record<string, unknown>;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function leerDetail(body: unknown): { detail: FacturapiDetail; status?: number; mensaje?: string } {
  if (!body || typeof body !== "object") return { detail: {} };
  const b = body as Record<string, unknown>;
  const detail = (b.detail && typeof b.detail === "object" ? b.detail : b) as FacturapiDetail;
  const status = typeof b.status === "number" ? b.status : undefined;
  const mensaje = str(b.error) ?? str(b.message) ?? str(detail.message);
  return { detail, status, mensaje };
}

/** Lista de mensajes de `errors[]` de FacturApi, si viene. */
function listaErrores(errors: unknown): string[] {
  if (!Array.isArray(errors)) return [];
  return errors
    .map((e) => {
      if (typeof e === "string") return e;
      if (e && typeof e === "object") {
        const o = e as Record<string, unknown>;
        return [str(o.path), str(o.message)].filter(Boolean).join(": ");
      }
      return "";
    })
    .filter((s) => s.length > 0);
}

/**
 * Interpreta el body de un rechazo de FacturApi/SAT. Devuelve `null` si el
 * body no parece de facturación (para no secuestrar otros errores).
 */
export function interpretarErrorFacturapi(body: unknown): FacturapiErrorInterpretado | null {
  const { detail, status, mensaje } = leerDetail(body);
  const codigoCrudo = str(detail.code);
  const codigo = codigoCrudo
    ?? extraerCodigoSatDeTexto(mensaje)
    ?? extraerCodigoSatDeTexto(str(detail.message));
  const info = buscarCodigoSat(codigo);
  const errores = listaErrores(detail.errors);

  if (!info && !mensaje && !codigo) return null;

  const detalles: Record<string, unknown> = {
    codigoSat: codigo ?? null,
    status: status ?? null,
    campo: str(detail.path) ?? str(detail.location) ?? null,
    logId: str(detail.logId) ?? null,
    mensajeOriginal: mensaje ?? null,
    errores: errores.length > 0 ? errores : null,
  };

  if (info) {
    return {
      titulo: info.titulo,
      descripcion: errores.length > 0 ? `${info.accion} (${errores.join("; ")})` : info.accion,
      codigo: info.codigo,
      detalles,
    };
  }

  return {
    titulo: "El servicio de facturación rechazó la solicitud",
    descripcion: mensaje ?? "Intenta de nuevo; si el problema persiste, comparte los detalles con soporte.",
    codigo: codigo ?? null,
    detalles,
  };
}

/**
 * Traduce un mensaje suelto de FacturApi/SAT (cuando sólo tenemos el texto,
 * sin body estructurado). Devuelve `null` si no reconoce ningún código.
 */
export function traducirMensajeSat(texto: string): string | null {
  const info = buscarCodigoSat(extraerCodigoSatDeTexto(texto));
  if (!info) return null;
  return `${info.titulo}. ${info.accion}`;
}
