/**
 * Servicio: reconciliación a 3 columnas (Fase 2).
 *
 * Combina:
 * - Cotizado: costos de la versión aceptada (RPC obtener_costos_cotizacion_version).
 * - Refrescado: cotizado + delta aplicado al crear el embarque (Fase 1, tarifa_delta_jsonb).
 * - Real: monto REALMENTE facturado por el proveedor (partidas de facturas de
 *   proveedor vigentes, excluyendo canceladas). v13.823.370 (P1-2): antes se
 *   leía `conceptos_costo.monto`, que es el presupuesto clonado al convertir la
 *   cotización, así que un embarque sin ninguna factura mostraba "Real = 4,500 ·
 *   +0.0% · Dentro del rango". La fuente es `fetchReconciliacionEmbarque`, la
 *   misma que usa el tab Costos (no se duplica la regla).
 *
 * Devuelve filas alineadas por (concepto, moneda) listas para la UI.
 */
import { supabase } from "@/integrations/supabase/client";
import { obtenerEmbarqueInterno } from "./internoEmbarque";
import { fetchReconciliacionEmbarque } from "./reconciliacionCostos";
import {
  obtenerCostosCotizacionVersion,
  type CostoVersionado,
} from "@/features/cotizacion/services/versionado";
import {
  construirResumen,
  UMBRALES_DEFAULT,
  type UmbralesVarianza,
} from "@/lib/domain/versionadoCotizacion";
import {
  agruparRealesFacturados,
  buildFilas3C,
  type DeltaConcepto,
  type ResultadoReconciliacion3C,
} from "./reconciliacion3Columnas.helpers";

export * from "./reconciliacion3Columnas.helpers";

interface EmbarqueMeta {
  cotizacion_id: string | null;
  organization_id: string;
  version_aceptada: number | null;
  tipo_cambio_usd: number | string | null;
  tipo_cambio_eur: number | string | null;
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

  // 2. Reales: monto facturado por proveedor (facturas vigentes, sin canceladas).
  // Se reutiliza el servicio del tab Costos para no duplicar la regla.
  const reales = agruparRealesFacturados(await fetchReconciliacionEmbarque(embarqueId));

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
