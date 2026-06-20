/**
 * Servicio: reconciliación a 3 columnas (Fase 2).
 *
 * Combina:
 * - Cotizado: costos de la versión aceptada (RPC obtener_costos_cotizacion_version).
 * - Refrescado: cotizado + delta aplicado al crear el embarque (Fase 1, tarifa_delta_jsonb).
 * - Real: conceptos_costo vivos del embarque.
 *
 * Devuelve filas alineadas por (concepto, moneda) listas para la UI.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  obtenerCostosCotizacionVersion,
  type CostoVersionado,
} from "@/features/cotizacion/services/versionado";
import {
  construirFilaReconciliacion,
  construirResumen,
  UMBRALES_DEFAULT,
  type FilaReconciliacion3C,
  type ResumenReconciliacion3C,
  type UmbralesVarianza,
} from "@/features/cotizacion/domain/versionadoCotizacion";

interface DeltaConcepto {
  concepto: string;
  moneda?: string;
  monto_anterior?: number;
  monto_actual?: number | null;
}

interface ConceptoCostoRow {
  concepto: string;
  moneda: string;
  monto: number | string;
}

interface EmbarqueMeta {
  cotizacion_id: string | null;
  tarifa_delta_jsonb: unknown;
  organization_id: string;
  version_aceptada: number | null;
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
  reales: ConceptoCostoRow[],
  umbrales: UmbralesVarianza = UMBRALES_DEFAULT,
): FilaReconciliacion3C[] {
  const realesMap = new Map<string, ConceptoCostoRow>();
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
        { concepto: r.concepto, moneda: r.moneda, cotizado: 0, refrescado: 0, real: Number(r.monto) || 0 },
        umbrales,
      ),
    );
  }
  return filas;
}

export async function obtenerReconciliacion3Columnas(
  embarqueId: string,
  umbrales: UmbralesVarianza = UMBRALES_DEFAULT,
): Promise<ResultadoReconciliacion3C> {
  // 1. Meta del embarque (incluye cotizacion_id y delta de Fase 1).
  const { data: embRaw, error: embErr } = await supabase
    .from("embarques")
    // SAFE-CAST: tarifa_delta_jsonb se agregó en Fase 1 y puede no estar en tipos.
    .select("cotizacion_id, tarifa_delta_jsonb, organization_id" as unknown as string)
    .eq("id", embarqueId)
    .maybeSingle();
  if (embErr) throw new Error(embErr.message);
  if (!embRaw) {
    return {
      filas: [],
      resumen: construirResumen([], umbrales),
      tiene_cotizacion: false,
      version_aceptada: null,
    };
  }

  // SAFE-CAST: el select trae sólo columnas de EmbarqueMeta; Supabase devuelve unknown.
  const emb = embRaw as unknown as EmbarqueMeta;
  let cotizados: CostoVersionado[] = [];
  let versionAceptada: number | null = null;

  if (emb.cotizacion_id) {
    const { data: cotMeta, error: cotErr } = await supabase
      .from("cotizaciones")
      // SAFE-CAST: version_aceptada se agregó en Fase 2.
      .select("version_aceptada" as unknown as string)
      .eq("id", emb.cotizacion_id)
      .maybeSingle();
    if (cotErr) throw new Error(cotErr.message);
    // SAFE-CAST: version_aceptada existe pero el tipo generado aún no la incluye.
    versionAceptada = ((cotMeta as unknown as { version_aceptada: number | null } | null)
      ?.version_aceptada) ?? null;
    cotizados = await obtenerCostosCotizacionVersion(emb.cotizacion_id, versionAceptada);
  }

  // 2. Reales: conceptos_costo del embarque.
  const { data: realesRaw, error: realErr } = await supabase
    .from("conceptos_costo")
    .select("concepto, moneda, monto")
    .eq("embarque_id", embarqueId)
    .is("deleted_at", null);
  if (realErr) throw new Error(realErr.message);
  const reales = (realesRaw ?? []) as ConceptoCostoRow[];

  // 3. Delta del embarque (Fase 1).
  const deltaRaw = emb.tarifa_delta_jsonb as { cambios?: DeltaConcepto[] } | null;
  const delta = Array.isArray(deltaRaw?.cambios) ? deltaRaw!.cambios : [];

  const filas = buildFilas3C(cotizados, delta, reales, umbrales);
  return {
    filas,
    resumen: construirResumen(filas, umbrales),
    tiene_cotizacion: Boolean(emb.cotizacion_id),
    version_aceptada: versionAceptada,
  };
}
