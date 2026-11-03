/** Typed server rejection, including the versioned canonical diagnostic. */
import { z } from "zod";
import { parseDiagnosticoBajaEmbarque, type DiagnosticoBajaEmbarque } from "./diagnosticoBajaEmbarque";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0);
const legacyMotivosSchema = z.object({
  facturas: count,
  cxp: count,
  pagos_cxc: count,
  pagos_cxp: count,
  notas_credito_cxc: count,
  notas_credito_cxp: count,
  comisiones_definitivas: count,
  proformas: count,
  cerrado: z.boolean().default(false),
  expediente: z.string(),
}).strict();

/** Legacy valid HINTs remain readable while the server is published first. */
export type MotivosBloqueoEmbarque = z.infer<typeof legacyMotivosSchema> | DiagnosticoBajaEmbarque;

export class EmbarqueBloqueadoError extends Error {
  constructor(readonly motivos: MotivosBloqueoEmbarque) {
    super(`La eliminación del embarque ${motivos.expediente} está bloqueada.`);
    this.name = "EmbarqueBloqueadoError";
  }
}

interface PostgrestLike {
  message?: unknown;
  hint?: unknown;
}

function safeParseMotivos(raw: string, embarqueId?: string): MotivosBloqueoEmbarque | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
    if ("version" in data) {
      const result = parseDiagnosticoBajaEmbarque(data, embarqueId);
      return result.bloqueado ? result : null;
    }
    return legacyMotivosSchema.parse(data);
  } catch {
    return null;
  }
}

/** Invalid/incompatible HINTs keep the original error; never infer an empty result. */
export function toEmbarqueBloqueadoError(err: unknown, embarqueId?: string): EmbarqueBloqueadoError | null {
  if (typeof err !== "object" || err === null) return null;
  const error = err as PostgrestLike;
  if (typeof error.message !== "string" || !error.message.includes("LC_EMBARQUE_BLOQUEADO")) return null;
  const motivos = typeof error.hint === "string" ? safeParseMotivos(error.hint, embarqueId) : null;
  return motivos ? new EmbarqueBloqueadoError(motivos) : null;
}
