/**
 * Dominio del feed unificado de actividad de un embarque.
 * Sin dependencias de React: normaliza, deduplica y agrupa por día.
 */

export type ActividadCategoria = 'operacion' | 'comercial' | 'finanzas' | 'riesgo' | 'cierre';

export interface ActividadRow {
  id: string;
  categoria: string;
  tipo: string;
  fecha: string;
  usuario: string | null;
  accion: string | null;
  titulo: string | null;
  descripcion: string | null;
  monto: number | null;
  moneda: string | null;
  ref_tipo: string | null;
  ref_id: string | null;
  dedupe_key: string | null;
  detalles: unknown;
}

export interface ActividadItem {
  id: string;
  categoria: ActividadCategoria;
  tipo: string;
  fecha: string;
  usuario: string;
  accion: string;
  titulo: string;
  descripcion?: string;
  monto?: number;
  moneda?: string;
  refTipo?: string;
  refId?: string;
  detalles?: Record<string, unknown>;
}

export interface ActividadGrupo {
  dia: string;
  items: ActividadItem[];
}

const CATEGORIAS: ActividadCategoria[] = ['operacion', 'comercial', 'finanzas', 'riesgo', 'cierre'];

export const CATEGORIA_LABEL: Record<ActividadCategoria, string> = {
  operacion: 'Operación',
  comercial: 'Comercial',
  finanzas: 'Finanzas',
  riesgo: 'Riesgo',
  cierre: 'Cierre',
};

function normalizarCategoria(valor: string): ActividadCategoria {
  return (CATEGORIAS as string[]).includes(valor) ? (valor as ActividadCategoria) : 'operacion';
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export function normalizarActividad(rows: ActividadRow[]): ActividadItem[] {
  return rows
    .filter((r) => !!r.fecha)
    .map((r) => ({
      id: r.id,
      categoria: normalizarCategoria(r.categoria),
      tipo: r.tipo,
      fecha: r.fecha,
      usuario: r.usuario?.trim() ?? '',
      accion: r.accion?.trim() || r.tipo,
      titulo: r.titulo?.trim() || (r.accion ?? r.tipo),
      descripcion: r.descripcion?.trim() || undefined,
      monto: typeof r.monto === 'number' ? r.monto : undefined,
      moneda: r.moneda ?? undefined,
      refTipo: r.ref_tipo ?? undefined,
      refId: r.ref_id ?? undefined,
      detalles: esObjeto(r.detalles) ? r.detalles : undefined,
    }));
}

/**
 * Elimina duplicados de un mismo hecho registrado en varias fuentes
 * (por ejemplo un cambio de estado guardado en nota, evento y bitácora).
 * La bitácora tiene prioridad porque conserva el detalle de cambios.
 */
export function deduplicarActividad(items: ActividadItem[]): ActividadItem[] {
  const conClave = items.filter((i) => i.id.startsWith('bit-'));
  const clavesBitacora = new Set(
    conClave.map((i) => `${i.fecha.slice(0, 16)}`),
  );
  const vistos = new Set<string>();
  const out: ActividadItem[] = [];
  for (const item of items) {
    const esCambioEstadoAjeno =
      !item.id.startsWith('bit-') &&
      (item.accion === 'Cambio de estado' || item.titulo.startsWith('Estado cambiado a')) &&
      clavesBitacora.has(item.fecha.slice(0, 16));
    if (esCambioEstadoAjeno) continue;
    const clave = `${item.tipo}|${item.titulo}|${item.fecha.slice(0, 16)}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(item);
  }
  return out;
}

export function ordenarActividad(items: ActividadItem[]): ActividadItem[] {
  return [...items].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

export function filtrarPorCategoria(
  items: ActividadItem[],
  categoria: ActividadCategoria | 'todos',
): ActividadItem[] {
  if (categoria === 'todos') return items;
  return items.filter((i) => i.categoria === categoria);
}

export function agruparPorDia(items: ActividadItem[]): ActividadGrupo[] {
  const grupos = new Map<string, ActividadItem[]>();
  for (const item of items) {
    const dia = item.fecha.slice(0, 10);
    const lista = grupos.get(dia);
    if (lista) lista.push(item);
    else grupos.set(dia, [item]);
  }
  return Array.from(grupos.entries()).map(([dia, lista]) => ({ dia, items: lista }));
}

export function contarPorCategoria(items: ActividadItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) out[item.categoria] = (out[item.categoria] ?? 0) + 1;
  return out;
}
