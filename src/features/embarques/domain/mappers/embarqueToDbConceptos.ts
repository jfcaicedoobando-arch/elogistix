/**
 * Mapeo de conceptos de venta/costo del formulario hacia payloads de BD.
 * Extraído de `embarqueToDb.ts` para mantenerlo bajo el límite de líneas
 * (Power-of-10); sin cambios de lógica.
 */
import type { ConceptoVentaLocal, ConceptoCostoLocal } from "@/types/concepto";
// BL-12: canon monetario — nunca `cantidad * precio` crudo (drift float).
import { subtotalLinea } from "@/lib/financial/financialUtils";
import { monedaSchema, monedaVentaSchema } from "./embarquePayloadSchemas";

export function buildConceptosVentaPayload(conceptosVenta: ConceptoVentaLocal[]) {
  return conceptosVenta
    .filter((v) => v.concepto)
    .map((v) => ({
      // v13.207.0 — Enviamos el UUID de BD (si existe) para que el RPC
      // `actualizar_embarque_completo` haga merge en sitio y NO borre
      // conceptos que ya estén facturados.
      ...(v.dbId ? { id: v.dbId } : {}),
      descripcion: v.concepto,
      cantidad: v.cantidad,
      precio_unitario: v.precioUnitario,
      moneda: monedaVentaSchema.parse(v.moneda),
      total: subtotalLinea(v.cantidad, v.precioUnitario),
      contenedor_id: v.contenedorId ?? null,
    }));
}

export function buildConceptosCostoPayload(
  conceptosCosto: ConceptoCostoLocal[],
  proveedoresDb: { id: string; nombre: string }[],
) {
  return conceptosCosto
    .filter((c) => c.concepto)
    .map((c) => {
      // v13.509.0 — Si el costo no tiene proveedor de catálogo (típico en
      // costos replicados desde cotización), conservamos el nombre heredado
      // en vez de mandar cadena vacía y borrarlo en BD.
      const nombreCatalogo = proveedoresDb.find((p) => p.id === c.proveedorId)?.nombre;
      const nombre = (nombreCatalogo ?? c.proveedorNombre ?? "").trim();
      return {
        ...(c.dbId ? { id: c.dbId } : {}),
        proveedor_id: c.proveedorId || null,
        proveedor_nombre: nombre,
        concepto: c.concepto,
        monto: c.monto,
        moneda: monedaSchema.parse(c.moneda),
        contenedor_id: c.contenedorId ?? null,
      };
    });
}
