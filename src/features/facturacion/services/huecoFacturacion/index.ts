/**
 * Orquestador del "Hueco de Facturación".
 *
 * v13.301.42 — Fase C auditoría: si un embarque tiene al menos un
 * `conceptos_venta.estado_facturacion = 'pendiente'` (no borrado), REAPARECE
 * en el hueco aunque exista bridge, factura legacy o proforma histórica que
 * lo hubiera ocultado. Esto captura el caso "se agregan nuevos conceptos
 * después de facturar" (H6 de la auditoría).
 *
 * Fase A (v13.301.41) — exclusión "ya tiene CFDI" en dos capas:
 *   1. Bridge canónico `factura_embarques.activa = true` cuya factura está
 *      `Emitida`. Fuente de verdad desde v13.301.31.
 *   2. Fallback legacy: expediente con al menos una `facturas.estado='Emitida'`
 *      con PDF (para CFDIs históricos sin bridge).
 * Una factura sólo `Cancelada` deja de ocultar al embarque del hueco.
 *
 * Ventana temporal (v13.217.0):
 *   - `eta` capturado; `eta ≥ 2026-04-01`; `eta ≤ hoy + 3 días`.
 *   - `facturado_historico = false`.
 *   - Y NO todos sus conceptos de venta están en proformas marcadas como
 *     `facturada` (aceptación histórica del back-fill).
 */

import { fetchEmbarquesParaHueco, fetchVentasYFacturas, type ConceptoVentaDetalle } from "./fetchSources";
import {
  construirFilaHueco,
  indexarVentas,
  type FilaHueco,
} from "./buildFilas";

export type { FilaHueco } from "./buildFilas";

export interface HuecoFacturacionResult {
  filas: FilaHueco[];
  totalEmbarques: number;
  totalUsd: number;
  totalMxn: number;
}

/**
 * Devuelve el Set de embarque_id cuyos conceptos de venta no borrados están
 * TODOS cubiertos por una proforma con `estado_proforma='facturada'`. Estos
 * embarques se consideran facturados por aceptación histórica (back-fill) y
 * deben excluirse del hueco aunque no exista CFDI real.
 */
export function calcularExclusionesPorProformaHistorica(
  conceptos: ConceptoVentaDetalle[],
): Set<string> {
  const agrupado = new Map<string, { total: number; cubiertos: number }>();
  for (const c of conceptos) {
    const acc = agrupado.get(c.embarque_id) ?? { total: 0, cubiertos: 0 };
    acc.total += 1;
    const cubierto =
      c.estado_facturacion === "en_proforma" &&
      !!c.proforma_id &&
      c.proforma_estado === "facturada";
    if (cubierto) acc.cubiertos += 1;
    agrupado.set(c.embarque_id, acc);
  }
  const excluidos = new Set<string>();
  for (const [id, { total, cubiertos }] of agrupado) {
    if (total > 0 && cubiertos === total) excluidos.add(id);
  }
  return excluidos;
}

/**
 * v13.301.42 — Fase C: devuelve el Set de embarques con al menos un
 * concepto de venta `pendiente`. Estos embarques se consideran "con hueco
 * pendiente" y NO pueden ser ocultados por reglas de exclusión, aunque
 * exista un CFDI histórico.
 */
export function calcularEmbarquesConPendiente(
  conceptos: ConceptoVentaDetalle[],
): Set<string> {
  const set = new Set<string>();
  for (const c of conceptos) {
    if (c.estado_facturacion === "pendiente") set.add(c.embarque_id);
  }
  return set;
}

export async function fetchHuecoFacturacion({
  organizationId,
  hoy = new Date(),
}: {
  organizationId: string | null;
  hoy?: Date;
}): Promise<HuecoFacturacionResult> {
  // v13.217.0 — ampliamos el límite a hoy + 3 días naturales para dar buffer
  // al agente aduanal antes del arribo real del contenedor.
  const limite = new Date(hoy.getTime() + 3 * 24 * 60 * 60 * 1000);
  const limiteEtaIso = limite.toISOString().slice(0, 10);

  const arr = await fetchEmbarquesParaHueco(organizationId, limiteEtaIso);

  if (arr.length === 0) {
    return { filas: [], totalEmbarques: 0, totalUsd: 0, totalMxn: 0 };
  }

  const ids = arr.map((e) => e.id);
  const expedientes = Array.from(
    new Set(arr.map((e) => e.expediente).filter((x): x is string => !!x)),
  );

  const { ventas, expedientesFacturados, embarquesConBridge, conceptosDetalle } =
    await fetchVentasYFacturas(ids, expedientes, organizationId);
  const excluidosPorProformaHistorica = calcularExclusionesPorProformaHistorica(conceptosDetalle);
  const embarquesConPendiente = calcularEmbarquesConPendiente(conceptosDetalle);
  const ventasMap = indexarVentas(ventas);

  const filas: FilaHueco[] = [];
  let totalUsd = 0;
  let totalMxn = 0;
  for (const e of arr) {
    // v13.301.42 — Override de re-aparición: si hay conceptos pendientes,
    // el embarque siempre entra al hueco (nuevos conceptos post-facturación).
    const tienePendiente = embarquesConPendiente.has(e.id);
    if (!tienePendiente) {
      // Fuente de verdad principal: bridge activo con factura Emitida.
      if (embarquesConBridge.has(e.id)) continue;
      // Fallback legacy por expediente (facturas sin bridge, sólo si están vivas).
      if (e.expediente && expedientesFacturados.has(e.expediente)) continue;
      if (excluidosPorProformaHistorica.has(e.id)) continue;
    }
    const fila = construirFilaHueco(e, ventasMap, hoy);
    if (!fila) continue;
    totalMxn += fila.ventaMxn;
    totalUsd += fila.ventaUsd;
    filas.push(fila);
  }

  filas.sort((a, b) => b.diasDesdeEta - a.diasDesdeEta);

  return { filas, totalEmbarques: filas.length, totalUsd, totalMxn };
}
