/**
 * Lógica pura del Estado de Resultados (P&G) mensual.
 * Pivota conceptos_venta y conceptos_costo por modo de transporte
 * (Marítimo, Aéreo, Terrestre) y por descripción del concepto.
 * Conversión a MXN usando tipo_cambio_usd / tipo_cambio_eur del embarque.
 */
import currency from "currency.js";
import { convertirAMXN, calcularMargen, type Moneda } from "@/lib/financial/financialUtils";

export type ModoColumna = "Marítimo" | "Aéreo" | "Terrestre";
export const MODOS_COLUMNAS: readonly ModoColumna[] = ["Marítimo", "Aéreo", "Terrestre"] as const;

export interface EmbarqueER {
  id: string;
  modo: string;
  tipo_cambio_usd: number | null;
  tipo_cambio_eur: number | null;
}
export interface ConceptoVentaER {
  embarque_id: string;
  descripcion: string;
  total: number | string;
  moneda: string;
}
export interface ConceptoCostoER {
  embarque_id: string;
  concepto: string;
  monto: number | string;
  moneda: string;
}

export interface FilaER {
  concepto: string;
  porModo: Record<ModoColumna, number>;
  total: number;
}

export interface TotalER {
  porModo: Record<ModoColumna, number>;
  total: number;
}

export interface EstadoResultados {
  ingresos: FilaER[];
  costos: FilaER[];
  totalIngresos: TotalER;
  totalCostos: TotalER;
  utilidad: TotalER;
  margen: TotalER;
}

const emptyModos = (): Record<ModoColumna, number> => ({ "Marítimo": 0, "Aéreo": 0, "Terrestre": 0 });

function isModoColumna(modo: string): modo is ModoColumna {
  return modo === "Marítimo" || modo === "Aéreo" || modo === "Terrestre";
}

function normalizeKey(desc: string): string {
  return (desc ?? "").trim().toLowerCase();
}

function acumular(
  filas: Map<string, { display: string; porModo: Record<ModoColumna, currency.Any> }>,
  key: string,
  display: string,
  modo: ModoColumna,
  mxn: number,
) {
  let row = filas.get(key);
  if (!row) {
    row = {
      display,
      porModo: { "Marítimo": currency(0, { precision: 2 }), "Aéreo": currency(0, { precision: 2 }), "Terrestre": currency(0, { precision: 2 }) },
    };
    filas.set(key, row);
  }
  row.porModo[modo] = (row.porModo[modo] as currency).add(mxn);
}

function materializar(
  filas: Map<string, { display: string; porModo: Record<ModoColumna, currency.Any> }>,
): FilaER[] {
  const out: FilaER[] = [];
  for (const { display, porModo } of filas.values()) {
    const por: Record<ModoColumna, number> = {
      "Marítimo": (porModo["Marítimo"] as currency).value,
      "Aéreo": (porModo["Aéreo"] as currency).value,
      "Terrestre": (porModo["Terrestre"] as currency).value,
    };
    const total = por["Marítimo"] + por["Aéreo"] + por["Terrestre"];
    // Ocultar filas en cero en todas las columnas.
    if (total === 0) continue;
    out.push({ concepto: display, porModo: por, total });
  }
  out.sort((a, b) => b.total - a.total);
  return out;
}

function pivotConceptosVenta(
  embById: Map<string, EmbarqueER>,
  ventas: ConceptoVentaER[],
  out: Map<string, { display: string; porModo: Record<ModoColumna, currency.Any> }>,
): void {
  for (const v of ventas) {
    const emb = embById.get(v.embarque_id);
    if (!emb || !isModoColumna(emb.modo)) continue;
    const moneda = (v.moneda?.toUpperCase() ?? "MXN") as Moneda;
    const mxn = convertirAMXN(Number(v.total) || 0, moneda, emb.tipo_cambio_usd ?? 1, emb.tipo_cambio_eur ?? 1);
    acumular(out, normalizeKey(v.descripcion), (v.descripcion ?? "").trim() || "(Sin descripción)", emb.modo, mxn);
  }
}

function pivotConceptosCosto(
  embById: Map<string, EmbarqueER>,
  costos: ConceptoCostoER[],
  out: Map<string, { display: string; porModo: Record<ModoColumna, currency.Any> }>,
): void {
  for (const c of costos) {
    const emb = embById.get(c.embarque_id);
    if (!emb || !isModoColumna(emb.modo)) continue;
    const moneda = (c.moneda?.toUpperCase() ?? "MXN") as Moneda;
    const mxn = convertirAMXN(Number(c.monto) || 0, moneda, emb.tipo_cambio_usd ?? 1, emb.tipo_cambio_eur ?? 1);
    acumular(out, normalizeKey(c.concepto), (c.concepto ?? "").trim() || "(Sin descripción)", emb.modo, mxn);
  }
}

function sumarFilas(rows: FilaER[]): TotalER {
  const porModo = emptyModos();
  let total = 0;
  for (const r of rows) {
    porModo["Marítimo"] += r.porModo["Marítimo"];
    porModo["Aéreo"] += r.porModo["Aéreo"];
    porModo["Terrestre"] += r.porModo["Terrestre"];
    total += r.total;
  }
  return { porModo, total };
}

function calcularUtilidadYMargen(
  totalIngresos: TotalER,
  totalCostos: TotalER,
): { utilidad: TotalER; margen: TotalER } {
  const utilidad: TotalER = {
    porModo: {
      "Marítimo": totalIngresos.porModo["Marítimo"] - totalCostos.porModo["Marítimo"],
      "Aéreo": totalIngresos.porModo["Aéreo"] - totalCostos.porModo["Aéreo"],
      "Terrestre": totalIngresos.porModo["Terrestre"] - totalCostos.porModo["Terrestre"],
    },
    total: totalIngresos.total - totalCostos.total,
  };
  const margen: TotalER = {
    porModo: {
      "Marítimo": calcularMargen(totalIngresos.porModo["Marítimo"], totalCostos.porModo["Marítimo"]),
      "Aéreo": calcularMargen(totalIngresos.porModo["Aéreo"], totalCostos.porModo["Aéreo"]),
      "Terrestre": calcularMargen(totalIngresos.porModo["Terrestre"], totalCostos.porModo["Terrestre"]),
    },
    total: calcularMargen(totalIngresos.total, totalCostos.total),
  };
  return { utilidad, margen };
}

export function buildEstadoResultados(
  embarques: EmbarqueER[],
  ventas: ConceptoVentaER[],
  costos: ConceptoCostoER[],
): EstadoResultados {
  const embById = new Map<string, EmbarqueER>();
  for (const e of embarques) embById.set(e.id, e);

  const ingresosMap = new Map<string, { display: string; porModo: Record<ModoColumna, currency.Any> }>();
  const costosMap = new Map<string, { display: string; porModo: Record<ModoColumna, currency.Any> }>();

  pivotConceptosVenta(embById, ventas, ingresosMap);
  pivotConceptosCosto(embById, costos, costosMap);

  const ingresos = materializar(ingresosMap);
  const cstos = materializar(costosMap);
  const totalIngresos = sumarFilas(ingresos);
  const totalCostos = sumarFilas(cstos);
  const { utilidad, margen } = calcularUtilidadYMargen(totalIngresos, totalCostos);

  return { ingresos, costos: cstos, totalIngresos, totalCostos, utilidad, margen };
}
