import { z } from "zod";

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const ejemploFactura = z.object({
  id: z.string().uuid(),
  folio: z.string().nullable(),
  estado: z.string().nullable(),
}).strict();

/** Versioned response shared by the reader and the final mutation's HINT. */
export const diagnosticoBajaEmbarqueSchema = z.object({
  version: z.literal(1),
  embarque_id: z.string().uuid(),
  expediente: z.string(),
  facturas: count,
  cxp: count,
  pagos_cxc: count,
  pagos_cxp: count,
  notas_credito_cxc: count,
  notas_credito_cxp: count,
  comisiones_definitivas: count,
  proformas: count,
  cerrado: z.boolean(),
  bloqueado: z.boolean(),
  ejemplos_cxc: z.array(ejemploFactura).max(20),
  ejemplos_cxp: z.array(ejemploFactura).max(20),
}).strict().superRefine((value, ctx) => {
  const blocked = value.cerrado || value.facturas > 0 || value.cxp > 0 ||
    value.pagos_cxc > 0 || value.pagos_cxp > 0 || value.notas_credito_cxc > 0 ||
    value.notas_credito_cxp > 0 || value.comisiones_definitivas > 0 || value.proformas > 0;
  if (value.bloqueado !== blocked) ctx.addIssue({ code: "custom", message: "Inconsistent blocking result" });
  for (const [items, total] of [[value.ejemplos_cxc, value.facturas], [value.ejemplos_cxp, value.cxp]] as const) {
    if (items.length > total || new Set(items.map((item) => item.id)).size !== items.length) {
      ctx.addIssue({ code: "custom", message: "Inconsistent invoice examples" });
    }
  }
});

export type DiagnosticoBajaEmbarque = z.infer<typeof diagnosticoBajaEmbarqueSchema>;
export type FacturaLigada = z.infer<typeof ejemploFactura>;

export function parseDiagnosticoBajaEmbarque(data: unknown, embarqueId?: string): DiagnosticoBajaEmbarque {
  const result = diagnosticoBajaEmbarqueSchema.parse(data);
  if (embarqueId && result.embarque_id !== embarqueId) throw new Error("Unexpected shipment in deletion diagnostic");
  return result;
}
