/**
 * Helpers puros de la reconciliación a 3 columnas — sin Supabase.
 * Extraídos de `reconciliacion3Columnas.ts` para respetar el techo de 200
 * líneas por archivo (Power of 10).
 */
import type { CostoVersionado } from "@/features/cotizacion/services/versionado";
import { toCsv } from "@/lib/csv/serializeCsv";
import {
  construirFilaReconciliacion,
  UMBRALES_DEFAULT,
  type FilaReconciliacion3C,
  type ResumenReconciliacion3C,
  type UmbralesVarianza,
} from "@/lib/domain/versionadoCotizacion";

export interface DeltaConcepto {
  concepto: string;
  moneda?: string;
  monto_anterior?: number;
  monto_actual?: number | null;
}

/**
 * Real agregado por (concepto, moneda). `tiene_factura` es fail-closed: si no
 * se informa, el renglón se considera SIN factura y se clasifica `pendiente`.
 */
export interface RealPorConcepto {
  concepto: string;
  moneda: string;
  monto: number | string;
  tiene_factura?: boolean;
}

export interface ResultadoReconciliacion3C {
  filas: FilaReconciliacion3C[];
  resumen: ResumenReconciliacion3C;
  tiene_cotizacion: boolean;
  version_aceptada: number | null;
}

export function generarCsvReconciliacion3C(filas: FilaReconciliacion3C[]): string {
  return toCsv(
    ["Concepto", "Moneda", "Cotizado", "Refrescado", "Real", "Δ Cot vs Real (%)", "Clasificación"],
    filas.map((f) => [
      f.concepto,
      f.moneda,
      String(f.cotizado),
      String(f.refrescado),
      String(f.real),
      f.delta_cot_vs_real.pct.toFixed(2),
      f.clasificacion,
    ]),
  );
}

const norm = (v: string | null | undefined): string => (v ?? "").trim().toLowerCase();

interface EjeCotizado {
  concepto: string;
  moneda: string;
  cotizado: number;
}

/**
 * B3 — agrupa los costos cotizados en el eje (concepto, moneda). Sin esto, dos
 * costos "Maniobras/MXN" generaban dos filas y cada una repetía el mismo real,
 * duplicando el total facturado.
 */
function agruparCotizados(cotizados: CostoVersionado[]): Map<string, EjeCotizado> {
  const map = new Map<string, EjeCotizado>();
  for (const c of cotizados) {
    const key = `${norm(c.concepto)}|${norm(c.moneda)}`;
    const cur = map.get(key) ?? { concepto: c.concepto, moneda: c.moneda, cotizado: 0 };
    cur.cotizado += Number(c.costo_total) || 0;
    map.set(key, cur);
  }
  return map;
}

/**
 * B2 — el delta se cruza por concepto Y moneda. Los deltas legacy (sin moneda)
 * sólo se aplican cuando el concepto cotizado existe en una única moneda: con
 * "Flete" en USD y MXN no hay forma de saber a cuál pertenece y se conserva el
 * cotizado en lugar de duplicar el ajuste en ambas monedas.
 */
function resolverDelta(
  eje: EjeCotizado,
  delta: DeltaConcepto[],
  monedasPorConcepto: Map<string, Set<string>>,
): DeltaConcepto | undefined {
  const conMoneda = delta.find(
    (d) => norm(d.concepto) === norm(eje.concepto) && !!d.moneda && norm(d.moneda) === norm(eje.moneda),
  );
  if (conMoneda) return conMoneda;
  const monedas = monedasPorConcepto.get(norm(eje.concepto));
  if (!monedas || monedas.size !== 1) return undefined;
  return delta.find((d) => norm(d.concepto) === norm(eje.concepto) && !d.moneda);
}

function calcularRefrescado(
  eje: EjeCotizado,
  delta: DeltaConcepto[],
  monedasPorConcepto: Map<string, Set<string>>,
): number {
  const d = resolverDelta(eje, delta, monedasPorConcepto);
  if (!d || d.monto_actual == null) return eje.cotizado; // sin delta o eliminado en tarifa vigente
  return Number(d.monto_actual);
}

export function buildFilas3C(
  cotizados: CostoVersionado[],
  delta: DeltaConcepto[],
  reales: RealPorConcepto[],
  umbrales: UmbralesVarianza = UMBRALES_DEFAULT,
): FilaReconciliacion3C[] {
  const realesMap = new Map<string, RealPorConcepto>();
  for (const r of reales) {
    realesMap.set(`${norm(r.concepto)}|${norm(r.moneda)}`, r);
  }

  const ejes = agruparCotizados(cotizados);
  const monedasPorConcepto = new Map<string, Set<string>>();
  for (const eje of ejes.values()) {
    const set = monedasPorConcepto.get(norm(eje.concepto)) ?? new Set<string>();
    set.add(norm(eje.moneda));
    monedasPorConcepto.set(norm(eje.concepto), set);
  }

  const filas: FilaReconciliacion3C[] = [];
  const usadosReales = new Set<string>();

  for (const [key, eje] of ejes.entries()) {
    const real = realesMap.get(key);
    if (real) usadosReales.add(key);
    filas.push(
      construirFilaReconciliacion(
        {
          concepto: eje.concepto,
          moneda: eje.moneda,
          cotizado: eje.cotizado,
          refrescado: calcularRefrescado(eje, delta, monedasPorConcepto),
          real: real ? Number(real.monto) || 0 : 0,
          sin_factura: real?.tiene_factura !== true,
        },
        umbrales,
      ),
    );
  }

  // Conceptos reales sin contraparte cotizada (sólo aparecen en la columna real).
  for (const [key, r] of realesMap.entries()) {
    if (usadosReales.has(key)) continue;
    filas.push(
      construirFilaReconciliacion(
        {
          concepto: r.concepto,
          moneda: r.moneda,
          cotizado: 0,
          refrescado: 0,
          real: Number(r.monto) || 0,
          sin_factura: r.tiene_factura !== true,
        },
        umbrales,
      ),
    );
  }
  return filas;
}


/**
 * Agrupa las filas de conciliación (una por concepto de costo) en el eje
 * (concepto, moneda) que usa la tabla de 3 columnas, sumando SÓLO el monto
 * facturado por proveedor.
 */
export function agruparRealesFacturados(
  filas: ReadonlyArray<{
    concepto: string;
    moneda: string;
    real_facturado: number;
    facturas: ReadonlyArray<unknown>;
  }>,
): RealPorConcepto[] {
  const map = new Map<string, RealPorConcepto>();
  for (const f of filas) {
    // REC-02: la moneda se normaliza igual que el concepto; "USD", "usd" y
    // " USD " deben caer en el mismo renglón. La etiqueta original se conserva
    // para mostrar.
    const key = `${norm(f.concepto)}|${norm(f.moneda)}`;
    const cur = map.get(key) ?? { concepto: f.concepto, moneda: f.moneda, monto: 0, tiene_factura: false };
    cur.monto = (Number(cur.monto) || 0) + (Number(f.real_facturado) || 0);
    cur.tiene_factura = cur.tiene_factura === true || f.facturas.length > 0;
    map.set(key, cur);
  }
  return Array.from(map.values());
}
