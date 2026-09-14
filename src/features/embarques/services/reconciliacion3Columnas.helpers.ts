/**
 * Helpers puros de la reconciliación a 3 columnas — sin Supabase.
 * Extraídos de `reconciliacion3Columnas.ts` para respetar el techo de 200
 * líneas por archivo (Power of 10).
 */
import type { CostoVersionado } from "@/features/cotizacion/services/versionado";
import {
  construirFilaReconciliacion,
  UMBRALES_DEFAULT,
  type FilaReconciliacion3C,
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

interface EmbarqueMeta {
  cotizacion_id: string | null;
  organization_id: string;
  version_aceptada: number | null;
  tipo_cambio_usd: number | string | null;
  tipo_cambio_eur: number | string | null;
}

export interface ResultadoReconciliacion3C {
  filas: FilaReconciliacion3C[];
  resumen: ResumenReconciliacion3C;
  tiene_cotizacion: boolean;
  version_aceptada: number | null;
}

function aplicarDelta(cotizado: CostoVersionado, delta: DeltaConcepto[]): number {
  const d = delta.find(
    (x) => x.concepto.trim().toLowerCase() === cotizado.concepto.trim().toLowerCase(),
  );
  if (!d) return cotizado.costo_total;
  if (d.monto_actual == null) return cotizado.costo_total; // eliminado en tarifa vigente
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
    realesMap.set(`${r.concepto.trim().toLowerCase()}|${r.moneda}`, r);
  }

  const filas: FilaReconciliacion3C[] = [];
  const usadosReales = new Set<string>();

  for (const c of cotizados) {
    const key = `${c.concepto.trim().toLowerCase()}|${c.moneda}`;
    const real = realesMap.get(key);
    if (real) usadosReales.add(key);
    filas.push(
      construirFilaReconciliacion(
        {
          concepto: c.concepto,
          moneda: c.moneda,
          cotizado: c.costo_total,
          refrescado: aplicarDelta(c, delta),
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
    const key = `${f.concepto.trim().toLowerCase()}|${f.moneda}`;
    const cur = map.get(key) ?? { concepto: f.concepto, moneda: f.moneda, monto: 0, tiene_factura: false };
    cur.monto = (Number(cur.monto) || 0) + (Number(f.real_facturado) || 0);
    cur.tiene_factura = cur.tiene_factura === true || f.facturas.length > 0;
    map.set(key, cur);
  }
  return Array.from(map.values());
}
