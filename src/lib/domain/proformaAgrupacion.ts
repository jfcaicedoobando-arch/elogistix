/**
 * Helpers de agrupación/resumen para proformas pendientes (UI puro).
 * Extraído de `proforma.ts` para mantener cada archivo bajo Power-of-10 (≤200 líneas).
 */
import type { Moneda } from "./proforma";

/**
 * Forma mínima de proforma pendiente que esta lógica necesita.
 * Definida aquí para no acoplar el dominio al tipo Supabase del hook.
 */
export interface ProformaPendienteLite {
  id: string;
  numero: string;
  expediente: string;
  embarque_id: string | null;
  cliente_id: string;
  cliente_nombre: string;
  operador: string | null;
  dias_credito: number | null;
  bl_master: string | null;
  total_usd: number | string | null;
  total_mxn: number | string | null;
  embarques?: {
    bl_master?: string | null;
    contenedor?: string | null;
    tipo_contenedor?: string | null;
  } | null;
  /**
   * Lista de contenedores reales (hijos en `embarque_contenedores`) a los que
   * la proforma apunta vía `conceptos_venta.contenedor_id`. Si tiene 1 elemento
   * único, se usa para bucketizar la proforma; si tiene 2+ distintos, se bucketiza
   * como "múltiples contenedores"; si está vacía o sólo tiene nulls, fallback al
   * campo legacy `embarques.contenedor` para compatibilidad con datos antiguos.
   */
  contenedores_lista?: Array<{ numero: string | null; tipo: string | null }>;
}

export interface GrupoContenedor<T extends ProformaPendienteLite = ProformaPendienteLite> {
  contenedor: string | null;
  tipo_contenedor: string | null;
  proformas: T[];
}

export interface GrupoExpediente<T extends ProformaPendienteLite = ProformaPendienteLite> {
  expediente: string;
  embarqueId: string;
  blMaster: string | null;
  clienteId: string;
  clienteNombre: string;
  operador: string | null;
  diasCredito: number | null;
  proformas: T[];
  contenedores: GrupoContenedor<T>[];
}

/** Sentinel para bucket "múltiples contenedores" (no es un nombre real). */
export const MULTI_CONTENEDOR = "__multi__" as const;

/**
 * Decide el contenedor con el que se bucketiza una proforma:
 * 1) Si `contenedores_lista` tiene 1 sola entrada con numero → usa esa.
 * 2) Si tiene 2+ entradas distintas con numero → MULTI_CONTENEDOR.
 * 3) Si está vacía o sólo trae nulls → fallback al legacy `embarques.contenedor`.
 */
function resolverBucketContenedor(
  p: ProformaPendienteLite,
): { numero: string | null; tipo: string | null } {
  const lista = (p.contenedores_lista ?? []).filter((c) => c.numero);
  if (lista.length === 1) return { numero: lista[0].numero, tipo: lista[0].tipo };
  if (lista.length >= 2) return { numero: MULTI_CONTENEDOR, tipo: null };
  return {
    numero: p.embarques?.contenedor ?? null,
    tipo: p.embarques?.tipo_contenedor ?? null,
  };
}

/**
 * Agrupa proformas por expediente y, dentro de cada expediente, por contenedor.
 * Devuelve los grupos ordenados alfabéticamente por expediente.
 */
export function agruparProformasPendientes<T extends ProformaPendienteLite>(
  proformas: T[],
): GrupoExpediente<T>[] {
  const porEmbarque = new Map<string, GrupoExpediente<T>>();

  for (const p of proformas) {
    // Agrupar por embarque_id (no por expediente): el mismo expediente puede
    // estar repartido en varios embarques (un embarque por contenedor) y la
    // consolidación a nivel RPC exige un único embarque_id. Fallback al
    // expediente sólo por defensa para datos legacy donde embarque_id fuera null.
    const key = p.embarque_id ?? `exp:${p.expediente}`;
    if (!porEmbarque.has(key)) {
      porEmbarque.set(key, {
        expediente: p.expediente,
        embarqueId: p.embarque_id!,
        blMaster: p.embarques?.bl_master ?? p.bl_master ?? null,
        clienteId: p.cliente_id,
        clienteNombre: p.cliente_nombre,
        operador: p.operador,
        diasCredito: p.dias_credito,
        proformas: [],
        contenedores: [],
      });
    }
    porEmbarque.get(key)!.proformas.push(p);
  }

  for (const grupo of porEmbarque.values()) {
    const porContenedor = new Map<string, GrupoContenedor<T>>();
    for (const p of grupo.proformas) {
      const { numero, tipo } = resolverBucketContenedor(p);
      const key = numero ?? "__sin_contenedor__";
      if (!porContenedor.has(key)) {
        porContenedor.set(key, { contenedor: numero, tipo_contenedor: tipo, proformas: [] });
      }
      porContenedor.get(key)!.proformas.push(p);
    }
    grupo.contenedores = Array.from(porContenedor.values());
  }

  return Array.from(porEmbarque.values()).sort((a, b) => {
    const cmp = a.expediente.localeCompare(b.expediente);
    return cmp !== 0 ? cmp : a.embarqueId.localeCompare(b.embarqueId);
  });
}


/**
 * Devuelve el monto principal a mostrar de una proforma pendiente:
 * USD si hay, en caso contrario MXN.
 */
export function montoPrincipalProforma(
  p: Pick<ProformaPendienteLite, "total_usd" | "total_mxn">,
): { valor: number; moneda: Moneda } {
  const usd = Number(p.total_usd ?? 0);
  const mxn = Number(p.total_mxn ?? 0);
  if (usd > 0) return { valor: usd, moneda: "USD" };
  return { valor: mxn, moneda: "MXN" };
}

/**
 * Suma totales (USD/MXN) de un subconjunto de proformas seleccionadas por id.
 */
export function totalesProformasSeleccionadas<T extends ProformaPendienteLite>(
  proformas: T[],
  selectedIds: ReadonlySet<string>,
): { usd: number; mxn: number } {
  let usd = 0;
  let mxn = 0;
  for (const p of proformas) {
    if (selectedIds.has(p.id)) {
      usd += Number(p.total_usd ?? 0);
      mxn += Number(p.total_mxn ?? 0);
    }
  }
  return { usd, mxn };
}
