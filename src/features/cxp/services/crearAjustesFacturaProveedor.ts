/**
 * Crear renglones de ajuste de costo en el embarque cuando la factura
 * del proveedor difiere del costo devengado.
 *
 * Modelo (v13.303.97):
 *  - Por cada `vinculo` con `monto ≠ montoOriginal`, se agrega un nuevo
 *    `concepto_costo` en el mismo embarque con `monto = monto − montoOriginal`
 *    positivo. Un importe menor es facturación parcial, nunca un descuento.
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
import type { VinculoLinea } from "@/features/cxp/types";

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
  /** Confirmación manual de las notas con grapa contable; `false` = no se agregan. */
  confirmarAjustes?: (ajustes: AjustePropuesto[], moneda: Moneda) => Promise<boolean> | boolean;
}

export interface AjustePropuesto {
  descripcion: string;
  monto: number;
  original: number;
  facturado: number;
}

export interface CrearAjustesResult {
  ajustesCreados: number;
  /** El usuario rechazó agregar las notas de ajuste. */
  rechazados?: boolean;
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
    // Una asignación menor puede ser una parcialidad: no autoriza un descuento.
    // Las reducciones de presupuesto requieren un ajuste explícito por separado.
    .filter((x) => x.delta > TOLERANCIA)
    // Candado de magnitud: cierra el hueco de los vínculos legacy sin
    // `monedaBase`. Si el delta supera el total de la propia factura no es un
    // descuento real, es una mezcla de monedas. Sólo aplica cuando conocemos el
    // total (>0) para no bloquear flujos que no lo pasan.
    .filter((x) => {
      const tope = Number(input.totalFactura ?? 0);
      return tope <= 0 || Math.abs(x.delta) <= tope + TOLERANCIA;
    });

  if (deltas.length === 0) return { ajustesCreados: 0 };

  const ajustes = deltas.map((d) => ({
    embarque_id: d.vinculo.embarqueId,
    descripcion: d.vinculo.descripcion,
    monto: d.delta,
    original: d.vinculo.montoOriginal,
    facturado: d.vinculo.monto,
  }));

  // Validación manual: todo ajuste nace engrapado a la factura
  // (proveedor_facturas_conceptos), así que el usuario decide si se agrega.
  if (input.confirmarAjustes) {
    const ok = await input.confirmarAjustes(
      ajustes.map(({ descripcion, monto, original, facturado }) => ({ descripcion, monto, original, facturado })),
      input.moneda,
    );
    if (!ok) return { ajustesCreados: 0, rechazados: true };
  }

  // SAFE-CAST: `ajustes` es un arreglo de objetos planos serializables a jsonb.
  const payload = ajustes.map(({ embarque_id, descripcion, monto }) => ({ embarque_id, descripcion, monto })) as unknown as Json;
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
