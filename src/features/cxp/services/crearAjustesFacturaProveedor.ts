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
  /**
   * Total de la factura en su propia moneda. Un ajuste nace de la diferencia
   * contra ESTA factura, así que jamás puede excederla: si lo hace, la base
   * congelada estaba en otra moneda (ELIMP00368: −546,777.68 USD sobre una
   * factura de 34,400 USD). Sirve de candado para vínculos legacy que no
   * declaran `monedaBase`. La RPC valida lo mismo en el servidor.
   */
  totalFactura?: number;
}

export interface CrearAjustesResult {
  ajustesCreados: number;
}

export async function crearAjustesFacturaProveedor(
  input: CrearAjustesInput,
): Promise<CrearAjustesResult> {
  const deltas = Object.values(input.vinculos)
    // Candado de moneda: `monto` y `montoOriginal` se congelan en la moneda que
    // la factura tenía al marcar el costo. Si esa moneda ya no es la de la
    // factura, el delta compara peras con manzanas y produciría un ajuste
    // fantasma (ELIMP00358: 60 USD − 1,013.68 MXN = −953.68). Se descarta.
    .filter((v) => !v.monedaBase || v.monedaBase === input.moneda)
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

  // SAFE-CAST: `ajustes` es un arreglo de objetos planos serializables a jsonb.
  const payload = ajustes as unknown as Json;
  const { data, error } = await supabase.rpc("crear_ajustes_factura_proveedor_rpc", {
    p_factura_id: input.facturaId,
    p_ajustes: payload,
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
