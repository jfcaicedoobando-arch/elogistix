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
import { obtenerEmbarqueInterno } from "./internoEmbarque";
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
} from "@/lib/domain/versionadoCotizacion";

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
  // 1. Meta del embarque (cotizacion_id). El delta de Fase 1 vive en
  // `embarques_interno_v` desde FIX2 · B-1 (columna revocada a authenticated).
  const { data: embRaw, error: embErr } = await supabase
    .from("embarques")
    .select("cotizacion_id, organization_id, tipo_cambio_usd, tipo_cambio_eur")
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

  // 3. Delta del embarque (Fase 1) desde la vista interna (sólo staff).
  const interno = await obtenerEmbarqueInterno(embarqueId);
  const deltaRaw = interno?.tarifa_delta_jsonb as { cambios?: DeltaConcepto[] } | null;
  const delta = Array.isArray(deltaRaw?.cambios) ? deltaRaw!.cambios : [];

  const filas = buildFilas3C(cotizados, delta, reales, umbrales);
  // Auditoría 2026-08-28 · Hallazgo 3: los totales se normalizan a MXN con el
  // TC del embarque (antes se sumaban monedas distintas y se rotulaban "USD").
  const tc = {
    usd: Number(emb.tipo_cambio_usd) || undefined,
    eur: Number(emb.tipo_cambio_eur) || undefined,
  };
  return {
    filas,
    resumen: construirResumen(filas, umbrales, tc),
    tiene_cotizacion: Boolean(emb.cotizacion_id),
    version_aceptada: versionAceptada,
  };
}
