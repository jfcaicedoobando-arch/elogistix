import { z } from "zod";
import { toReadableError } from "./facturapiError";

/** Cancellation can already be in flight even when the response is unreadable. */
export class CancelacionContratoError extends Error {
  readonly uncertain = true;
  constructor() {
    super("No se pudo confirmar la respuesta de cancelación. Consulta el estado de la factura antes de volver a solicitarla.");
    this.name = "CancelacionContratoError";
  }
}
const detailSchema = z.object({
  code: z.string().optional(), message: z.string().optional(), path: z.string().optional(),
  logId: z.string().optional(), errors: z.unknown().optional(),
});
const errorSchema = z.object({
  error: z.string().min(1),
  acuse_status: z.never().optional(), acuse_guardado: z.never().optional(),
  message: z.string().optional(),
  issues: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  transient: z.boolean().optional(),
  detail: z.union([detailSchema, z.string()]).optional(),
  status: z.number().int().min(100).max(599).optional(),
  ok: z.literal(false).optional(),
  pending: z.literal(false).optional(),
  uncertain: z.literal(false).optional(),
  sustituida: z.literal(false).optional(),
  cancellation_status: z.enum(["rejected", "expired", "none"]).optional(),
});
const rejectionSchema = z.object({
  ok: z.literal(false), cancellation_status: z.enum(["rejected", "expired"]), message: z.string().min(1),
  pending: z.literal(false).optional(), uncertain: z.literal(false).optional(),
  sustituida: z.literal(false).optional(), transient: z.literal(false).optional(),
  acuse_status: z.never().optional(), acuse_guardado: z.never().optional(),
}).strict();

/** Applies equally to structured 2xx errors and non-2xx response bodies. */
export function interpretarErrorCancelacion(data: unknown): Error {
  const parsed = errorSchema.safeParse(data);
  if (parsed.success) {
    const body = parsed.data;
    // The provider request was already sent, or accepted before persistence failed.
    if (["facturapi_timeout", "cerrar_cancelacion_failed", "db_update_failed"].includes(body.error)) {
      return new CancelacionContratoError();
    }
    // Only the documented SAT-unavailable variant can offer a retry.
    if (body.transient && !(body.error === "facturapi_error" && body.status && body.status >= 400 && body.message)) {
      return new CancelacionContratoError();
    }
    return toReadableError(null, {
      ...body, detail: typeof body.detail === "string" ? { message: body.detail } : body.detail,
    }, body.error);
  }
  // A status rejection has no `error` field in the deployed adapter.
  const rejected = rejectionSchema.safeParse(data);
  if (rejected.success && typeof data === "object" && data !== null && !("error" in data)) {
    return toReadableError(null, { message: rejected.data.message, transient: false }, rejected.data.message);
  }
  return new CancelacionContratoError();
}
