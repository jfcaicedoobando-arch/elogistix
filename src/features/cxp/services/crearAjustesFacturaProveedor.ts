/**
 * Crear renglones de ajuste de costo en el embarque cuando la factura
 * del proveedor difiere del costo devengado.
 *
 * Modelo (v13.303.97):
 *  - Por cada `vinculo` con `monto ≠ montoOriginal`, se agrega un nuevo
 *    `concepto_costo` en el mismo embarque con `monto = monto − montoOriginal`
 *    (firmado). Signo negativo → descuento del proveedor → utilidad sube.
 *  - El ajuste se registra también en `proveedor_facturas_conceptos` para
 *    trazabilidad y para que el trigger `tg_pfc_recalc_liq` propague estado.
 *  - `origen='ajuste_factura_proveedor'` permite distinguirlos en UI y en
 *    la reversión al cancelar la factura (trigger BD `tg_reverse_ajustes_on_cancel`).
 *
 * Ola 3 · P1 (atomicidad): la limpieza de ajustes previos + inserción de
 * conceptos + puentes se ejecuta dentro de la RPC
 * `crear_ajustes_factura_proveedor_rpc`, en UNA sola transacción. Antes eran
 * 3 llamadas independientes: si fallaba la última, quedaban conceptos de
 * costo huérfanos (sin puente) inflando el costo del embarque.
 */
import currency from "currency.js";
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";
import type { Database, Json } from "@/integrations/supabase/types";
import type { VinculoLinea } from "@/features/cxp/hooks/useNuevaFacturaProveedorForm.helpers";

type Moneda = Database["public"]["Enums"]["moneda"];
const TOLERANCIA = 0.01;

export interface CrearAjustesInput {
  facturaId: string;
  organizationId: string;
  folio: string;
  fechaEmision: string;
  moneda: Moneda;
  proveedorId: string;
  proveedorNombre: string;
  vinculos: Record<string, VinculoLinea>;
}

export interface CrearAjustesResult {
  ajustesCreados: number;
}

export async function crearAjustesFacturaProveedor(
  input: CrearAjustesInput,
): Promise<CrearAjustesResult> {
  const deltas = Object.values(input.vinculos)
    .map((v) => ({
      vinculo: v,
      delta: currency(v.monto, { precision: 4 }).subtract(v.montoOriginal).value,
    }))
    .filter((x) => Math.abs(x.delta) > TOLERANCIA);

  if (deltas.length === 0) return { ajustesCreados: 0 };

  const ajustes = deltas.map((d) => ({
    embarque_id: d.vinculo.embarqueId,
    descripcion: d.vinculo.descripcion,
    monto: d.delta,
  }));

  const { data, error } = await supabase.rpc("crear_ajustes_factura_proveedor_rpc", {
    p_factura_id: input.facturaId,
    p_ajustes: ajustes as unknown as Json,
  });
  if (error) throw error;

  // SAFE-CAST: la RPC devuelve { ajustes_creados: number, folio: string }.
  const creados = Number((data as { ajustes_creados?: number } | null)?.ajustes_creados ?? 0);

  await registrarActividad({
    modulo: "cxp",
    accion: "crear_ajustes_factura_proveedor",
    entidadId: input.facturaId,
    entidadNombre: input.folio,
    detalles: { ajustesCreados: creados },
  });

  return { ajustesCreados: creados };
}
