/**
 * Orquestador del "Hueco de Facturación".
 *
 * v13.217.0 — Se amplía la ventana a **ETA ≤ hoy + 3 días** para dar buffer al
 * agente aduanal (antes: `eta ≤ hoy`). Criterios:
 *   - `eta` capturado (embarques sin ETA se excluyen).
 *   - `eta ≥ 2026-04-01` (corte del modelo nuevo, no revive back-fill).
 *   - `eta ≤ hoy + 3 días` (ya vencidos o próximos a arribar → necesita CFDI
 *     para cruzar aduana con margen).
 *   - Y NO tiene factura con `factura_pdf_url` asociada por expediente.
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
  const ventasMap = indexarVentas(ventas);

  const filas: FilaHueco[] = [];
  let totalUsd = 0;
  let totalMxn = 0;
  for (const e of arr) {
    // Fuente de verdad principal: bridge activo con factura Emitida.
    if (embarquesConBridge.has(e.id)) continue;
    // Fallback legacy por expediente (facturas sin bridge, sólo si están vivas).
    if (e.expediente && expedientesFacturados.has(e.expediente)) continue;
    if (excluidosPorProformaHistorica.has(e.id)) continue;
    const fila = construirFilaHueco(e, ventasMap, hoy);
    if (!fila) continue;
    totalMxn += fila.ventaMxn;
    totalUsd += fila.ventaUsd;
    filas.push(fila);
  }

  filas.sort((a, b) => b.diasDesdeEta - a.diasDesdeEta);

  return { filas, totalEmbarques: filas.length, totalUsd, totalMxn };
}
