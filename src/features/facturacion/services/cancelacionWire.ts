import { z } from "zod";
import { CancelacionContratoError, interpretarErrorCancelacion } from "./cancelacionErrorWire";
export { CancelacionContratoError } from "./cancelacionErrorWire";

const common = {
  ok: z.literal(true),
  message: z.string().optional(),
  vence_en: z.string().nullable().optional(),
};
const cancelacionSchema = z.union([
  z.object({
    ...common,
    cancellation_status: z.literal("accepted"),
    sustituida: z.boolean(),
    pending: z.literal(false).optional(),
    uncertain: z.literal(false).optional(),
  }),
  z.object({
    ...common,
    cancellation_status: z.enum(["pending", "verifying"]),
    pending: z.literal(true),
    uncertain: z.boolean().optional(),
    sustituida: z.literal(false).optional(),
  }),
]);
const acuseSchema = z.object({
  ok: z.literal(true),
  acuse_status: z.string().regex(/^(accepted|pending|error_network|error_[1-5][0-9]{2})$/),
  acuse_guardado: z.boolean(),
}).refine((r) => r.acuse_guardado === (r.acuse_status === "accepted"));

export function interpretarCancelacion(data: unknown) {
  if (typeof data === "object" && data !== null && "error" in data) throw interpretarErrorCancelacion(data);
  const result = cancelacionSchema.safeParse(data);
  if (!result.success) throw new CancelacionContratoError();
  const wire = result.data;
  return {
    sustituida: wire.sustituida ?? false,
    pending: wire.pending ?? false,
    uncertain: wire.uncertain ?? false,
    cancellation_status: wire.cancellation_status,
    vence_en: wire.vence_en ?? null,
    message: wire.message,
  };
}

export function interpretarAcuse(data: unknown) {
  if (typeof data === "object" && data !== null && "error" in data) throw interpretarErrorCancelacion(data);
  const result = acuseSchema.safeParse(data);
  if (!result.success) throw new CancelacionContratoError();
  return { acuse_status: result.data.acuse_status, acuse_guardado: result.data.acuse_guardado };
}
