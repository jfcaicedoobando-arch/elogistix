/**
 * Lógica pura del Estado de Resultados (P&G) mensual.
 * Pivota conceptos_venta y conceptos_costo por modo de transporte
 * (Marítimo, Aéreo, Terrestre) y por descripción del concepto.
 * Conversión a MXN usando tipo_cambio_usd / tipo_cambio_eur del embarque.
 */
import currency from "currency.js";
import type { ExclusionTcER, ValuacionER } from "./valuacion";
import { calcularMargen } from "@/lib/financial/financialUtils";
import { convertirMxn } from "@/lib/financial/convertir";

export type ModoColumna = "Marítimo" | "Aéreo" | "Terrestre" | "Otros";
export const MODOS_COLUMNAS: readonly ModoColumna[] = ["Marítimo", "Aéreo", "Terrestre", "Otros"] as const;

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
  /** Importes numéricos son parciales cuando completa=false; no usar como resultado exacto. */
  valuacion?: ValuacionER;
  /** NC históricas sin base fiscal: totales provisionales, crédito excluido. */
  notas_proveedor_sin_base?: string[];
  ingresos: FilaER[];
  costos: FilaER[];
  totalIngresos: TotalER;
  totalCostos: TotalER;
  utilidad: TotalER;
  margen: TotalER;
}

const emptyModos = (): Record<ModoColumna, number> => ({ "Marítimo": 0, "Aéreo": 0, "Terrestre": 0, "Otros": 0 });

/**
 * Mapea el `modo` crudo del embarque a una columna del EERR. Cualquier
 * modo no reconocido (Multimodal, vacío, mayúsculas, con acentos raros)
 * cae a "Otros" para que sus conceptos NO se pierdan silenciosamente —
 * antes eran descartados y hacían que "Utilidad operativa" no cuadrara
 * con "Ingresos del periodo".
 */
function resolverModoColumna(modo: string): ModoColumna {
  const raw = (modo ?? "").trim();
  if (raw === "Marítimo" || raw === "Aéreo" || raw === "Terrestre") return raw;
  return "Otros";
}

/**
 * Clave canónica para colapsar filas del pivot. Ignora acentos, colapsa
 * espacios múltiples y normaliza mayúsculas — evita que "Flete Marítimo"
 * y "Flete Maritimo" o "THC" y "THC  " aparezcan como filas separadas.
 */
function normalizeKey(desc: string): string {
  return (desc ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const emptyModosCurrency = (): Record<ModoColumna, currency.Any> => ({
  "Marítimo": currency(0, { precision: 2 }),
  "Aéreo": currency(0, { precision: 2 }),
  "Terrestre": currency(0, { precision: 2 }),
  "Otros": currency(0, { precision: 2 }),
});

function acumular(
  filas: Map<string, { display: string; porModo: Record<ModoColumna, currency.Any> }>,
  key: string,
  display: string,
  modo: ModoColumna,
  mxn: number,
) {
  let row = filas.get(key);
  if (!row) {
    row = { display, porModo: emptyModosCurrency() };
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
      "Otros": (porModo["Otros"] as currency).value,
    };
    const total = por["Marítimo"] + por["Aéreo"] + por["Terrestre"] + por["Otros"];
    // Ocultar filas en cero en todas las columnas.
    if (MODOS_COLUMNAS.every((modo) => por[modo] === 0)) continue;
    out.push({ concepto: display, porModo: por, total });
  }
  out.sort((a, b) => b.total - a.total);
  return out;
}

function pivotConceptos<T extends { embarque_id: string; moneda: string }>(
  embById: Map<string, EmbarqueER>,
  items: T[],
  getDesc: (i: T) => string,
  getMonto: (i: T) => number | string,
  destino: {
    out: Map<string, { display: string; porModo: Record<ModoColumna, currency.Any> }>;
    excluidos: ExclusionTcER[]; seccion: ExclusionTcER["seccion"];
  },
): void {
  const { out, excluidos, seccion } = destino;
  for (const i of items) {
    const emb = embById.get(i.embarque_id);
    if (!emb) continue;
    const columna = resolverModoColumna(emb.modo);
    // FIX C6: sin TC válido NO se suma como MXN (antes `?? 1` inflaba el P&G).
    const { mxn } = convertirMxn(Number(getMonto(i)) || 0, i.moneda, {
      usd: emb.tipo_cambio_usd, eur: emb.tipo_cambio_eur,
    });
    if (mxn === null) {
      excluidos.push({ embarque_id: i.embarque_id, concepto: getDesc(i),
        nominal: Number(getMonto(i)) || 0, moneda: i.moneda.trim().toUpperCase(), seccion, modo: columna });
      continue;
    }

    const desc = getDesc(i);
    acumular(out, normalizeKey(desc), (desc ?? "").trim() || "(Sin descripción)", columna, mxn);
  }
}


function sumarFilas(rows: FilaER[]): TotalER {
  const porModo = emptyModos();
  let total = 0;
  for (const r of rows) {
    for (const col of MODOS_COLUMNAS) porModo[col] += r.porModo[col];
    total += r.total;
  }
  return { porModo, total };
}


function calcularUtilidadYMargen(
  totalIngresos: TotalER,
  totalCostos: TotalER,
): { utilidad: TotalER; margen: TotalER } {
  const utilPorModo = emptyModos();
  const margenPorModo = emptyModos();
  for (const col of MODOS_COLUMNAS) {
    utilPorModo[col] = totalIngresos.porModo[col] - totalCostos.porModo[col];
    margenPorModo[col] = calcularMargen(totalIngresos.porModo[col], totalCostos.porModo[col]);
  }
  return {
    utilidad: { porModo: utilPorModo, total: totalIngresos.total - totalCostos.total },
    margen: { porModo: margenPorModo, total: calcularMargen(totalIngresos.total, totalCostos.total) },
  };
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

  const excluidos: ExclusionTcER[] = [];
  pivotConceptos(embById, ventas, (v) => v.descripcion, (v) => v.total, { out: ingresosMap, excluidos, seccion: "ingresos" });
  pivotConceptos(embById, costos, (c) => c.concepto, (c) => c.monto, { out: costosMap, excluidos, seccion: "costos" });

  const ingresos = materializar(ingresosMap);
  const cstos = materializar(costosMap);
  const totalIngresos = sumarFilas(ingresos);
  const totalCostos = sumarFilas(cstos);
  const { utilidad, margen } = calcularUtilidadYMargen(totalIngresos, totalCostos);

  return { ingresos, costos: cstos, totalIngresos, totalCostos, utilidad, margen,
    valuacion: { completa: excluidos.length === 0, conceptos_sin_tc_count: excluidos.length, excluidos_sin_tc: excluidos } };
}
