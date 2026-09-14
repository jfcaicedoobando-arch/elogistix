import type { ProformaDetalleFull, ProformaEnvioLite, ProformaFacturaAsociada, ProformaFacturaAsociadaLite } from "./types";

type RawAsociada = ProformaFacturaAsociada & { deleted_at: string | null; created_at: string };

/**
 * Post-procesa el resultado del embed `facturas_asociadas:facturas!proforma_id(...)`
 * de `fetchProformaPorId`: filtra facturas eliminadas lógicamente, ordena por fecha
 * de creación y descarta las columnas auxiliares (`deleted_at`, `created_at`) que
 * sólo se usaron para filtrar/ordenar. También normaliza el embed `envios`
 * (`proforma_envios`) dejándolo ordenado del más reciente al más antiguo.
 * Función pura para poder testearla aislada.
 */
export function mergeProformaDetalle(data: unknown): ProformaDetalleFull {
  // SAFE-CAST: PostgREST embed devuelve `unknown`; validamos forma mínima antes de mapear.
  const raw = data as {
    facturas_asociadas?: RawAsociada[] | null;
    factura_vinculada?: RawAsociada | null;
    factura_vinculada_secundaria?: RawAsociada | null;
    envios?: ProformaEnvioLite[] | null;
  } & Record<string, unknown>;
  // D6 (v13.823.382): además de la FK inversa se aceptan las facturas
  // vinculadas por `factura_id` / `factura_secundaria_id` (fusión N→1), sin
  // duplicar por `id` y sin las borradas.
  const vistas = new Map<string, RawAsociada>();
  for (const f of [
    ...(raw.facturas_asociadas ?? []),
    raw.factura_vinculada ?? null,
    raw.factura_vinculada_secundaria ?? null,
  ]) {
    if (!f || f.deleted_at || vistas.has(f.id)) continue;
    vistas.set(f.id, f);
  }
  const asociadas = Array.from(vistas.values())
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(({ deleted_at: _d, created_at: _c, ...rest }) => rest);
  const envios = [...(raw.envios ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  // SAFE-CAST: reconstruimos el objeto sobre el shape ya conocido de ProformaDetalleFull.
  return {
    ...(data as Record<string, unknown>),
    facturas_asociadas: asociadas,
    envios,
  } as ProformaDetalleFull;
}

/**
 * C30 (v13.823.381) — Une en `facturas_asociadas` las facturas que llegan por
 * la FK inversa (`facturas.proforma_id`) con las vinculadas por
 * `proformas.factura_id` / `factura_secundaria_id`. Una fusión de varias
 * proformas produce facturas con `proforma_id = NULL`: sin esta mezcla el
 * listado perdía la etiqueta del ciclo y el acceso al documento.
 *
 * Descarta facturas en papelera y nunca duplica un mismo `id`.
 */
export function mergeFacturasVinculadas<
  T extends {
    facturas_asociadas?: ProformaFacturaAsociadaLite[];
    factura_vinculada?: ProformaFacturaAsociadaLite | null;
    factura_vinculada_secundaria?: ProformaFacturaAsociadaLite | null;
  },
>(p: T): T & { facturas_asociadas: ProformaFacturaAsociadaLite[] } {
  const vistas = new Map<string, ProformaFacturaAsociadaLite>();
  const candidatas = [
    ...(p.facturas_asociadas ?? []),
    p.factura_vinculada,
    p.factura_vinculada_secundaria,
  ];
  for (const f of candidatas) {
    if (!f || f.deleted_at || vistas.has(f.id)) continue;
    vistas.set(f.id, f);
  }
  return { ...p, facturas_asociadas: Array.from(vistas.values()) };
}
