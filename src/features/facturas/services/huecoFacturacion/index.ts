/**
 * Orquestador del "Hueco de Facturación".
 *
 * Un embarque está en "hueco" si:
 *   - ETD >= 2026-04-01 (fecha de inicio del modelo nuevo)
 *   - (hoy - ETD) > 5 días (ya nos facturó el proveedor)
 *   - Y NO tiene factura con factura_pdf_url asociada por expediente.
 */
import { fetchEmbarquesParaHueco, fetchVentasYFacturas } from "./fetchSources";
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

const DIAS_UMBRAL = 5;

export async function fetchHuecoFacturacion({
  organizationId,
  hoy = new Date(),
}: {
  organizationId: string | null;
  hoy?: Date;
}): Promise<HuecoFacturacionResult> {
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() - DIAS_UMBRAL - 1);
  const limiteIso = limite.toISOString().slice(0, 10);

  const arr = await fetchEmbarquesParaHueco(organizationId, limiteIso);
  if (arr.length === 0) {
    return { filas: [], totalEmbarques: 0, totalUsd: 0, totalMxn: 0 };
  }

  const ids = arr.map((e) => e.id);
  const expedientes = Array.from(
    new Set(arr.map((e) => e.expediente).filter((x): x is string => !!x)),
  );

  const { ventas, facturas } = await fetchVentasYFacturas(ids, expedientes);
  const facturadosSet = new Set<string>(
    facturas.map((f) => f.expediente).filter((x): x is string => !!x),
  );
  const ventasMap = indexarVentas(ventas);

  const filas: FilaHueco[] = [];
  let totalUsd = 0;
  let totalMxn = 0;
  for (const e of arr) {
    if (e.expediente && facturadosSet.has(e.expediente)) continue;
    const fila = construirFilaHueco(e, ventasMap, hoy);
    if (!fila) continue;
    totalMxn += fila.ventaMxn;
    totalUsd += fila.ventaUsd;
    filas.push(fila);
  }

  filas.sort((a, b) => b.diasDesdeEtd - a.diasDesdeEtd);

  return { filas, totalEmbarques: filas.length, totalUsd, totalMxn };
}
