/** Validación del snapshot local: no inferir moneda, linaje ni tratamiento fiscal. */
import { z } from "zod";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/types";

const numero = z.number().finite();
const ventaSchema = z.object({
  origen_costo_id: z.string().min(1).optional(),
  id: z.string().optional(), clave_sat: z.string().optional(),
  descripcion: z.string(), unidad_medida: z.string(),
  cantidad: numero, precio_unitario: numero, total: numero,
  moneda: z.enum(["USD", "MXN"]), aplica_iva: z.boolean(),
  tasa_iva_aplicada: numero.optional(), tipo_iva: z.string().optional(), notas: z.string().optional(),
}).passthrough();

export function leerVentasBorrador(raw: unknown, moneda?: "USD" | "MXN"): ConceptoVentaCotizacion[] | null {
  const parsed = z.array(ventaSchema).safeParse(raw);
  if (!parsed.success || (moneda && parsed.data.some(c => c.moneda !== moneda))) return null;
  return parsed.data;
}

export function ventasTienenContenido(ventas: ConceptoVentaCotizacion[] = []): boolean {
  return ventas.some(c => Boolean(c.descripcion.trim() || c.origen_costo_id || c.precio_unitario || c.notas));
}

const costoSchema = z.object({
  concepto: z.string(), moneda: z.enum(["USD", "MXN"]), proveedor: z.string(),
  cantidad: numero, costo_unitario: numero, precio_venta: numero, unidad_medida: z.string(),
  origen_venta_id: z.string().nullable().optional(), venta_vinculo_pendiente: z.boolean().optional(),
  aplica_iva: z.boolean().optional(), notas: z.string().optional(), clave_sat: z.string().optional(),
  tasa_iva_aplicada: numero.optional(), tipo_iva: z.string().optional(),
  costeo_tarifa_id: z.string().nullable().optional(), costeo_tarifa_recargo_id: z.string().nullable().optional(),
  concepto_libre: z.boolean().optional(),
}).passthrough();
const snapshotSchema = z.object({
  userId: z.string(), organizationId: z.string().nullable(),
  conceptosUSD: z.array(ventaSchema).refine(rows => rows.every(c => c.moneda === "USD")),
  conceptosMXN: z.array(ventaSchema).refine(rows => rows.every(c => c.moneda === "MXN")),
  tipoCambioUsd: numero.positive().nullable(),
  costosInternos: z.array(costoSchema), costosSincronizados: z.array(costoSchema),
});
export function leerSnapshotVentasBorrador(raw: unknown, userId: string, organizationId?: string | null) {
  const parsed = snapshotSchema.safeParse(raw);
  if (!parsed.success) return null;
  if (parsed.data.userId !== userId || parsed.data.organizationId !== (organizationId ?? null)) return null;
  return parsed.data;
}
