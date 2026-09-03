/**
 * Helpers internos de `devengadas.ts`: nombres de vendedoras y rango de mes en
 * zona CDMX. Extraído para respetar el límite de tamaño de archivo (Power of 10).
 */
import { fetchNombresUsuarios } from "@/features/admin/services/usuario/availableUsers";

/**
 * B4 (Ola 7): los nombres de las vendedoras no viven en una tabla (se
 * resuelven vía edge function `user-management`, acción `list-nombres` —
 * defecto 10: sin email ni señales de sesión). Se resuelven en un solo viaje
 * y de forma best-effort: si falla, la columna muestra "—".
 */
export async function buildNombreVendedoraMap(ids: string[]): Promise<Record<string, string>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return {};
  try {
    const users = await fetchNombresUsuarios();
    const map: Record<string, string> = {};
    for (const u of users) {
      if (unicos.includes(u.id) && u.full_name) map[u.id] = u.full_name;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * Convierte un periodo "YYYY-MM" al rango de instantes UTC que cubre ese mes en
 * zona CDMX (UTC-06:00 fijo, México ya no aplica horario de verano).
 */
export function rangoMesMx(periodo?: string): { desde: string; hasta: string } | null {
  if (!periodo || !/^\d{4}-\d{2}$/.test(periodo)) return null;
  const [anio, mes] = periodo.split("-").map(Number);
  const desde = new Date(Date.UTC(anio, mes - 1, 1, 6, 0, 0));
  const hasta = new Date(Date.UTC(anio, mes, 1, 6, 0, 0));
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}

/** Filtros compartidos entre el listado (con cap) y la lectura de KPIs (completa). */
export interface FiltrableQuery<Q> {
  eq(col: string, val: string): Q;
  gte(col: string, val: string): Q;
  lt(col: string, val: string): Q;
}

export interface FetchComisionesFiltros {
  vendedora_id?: string | "todas";
  periodo?: string;
  estado?: string | "todos";
}

export function aplicarFiltros<Q extends FiltrableQuery<Q>>(
  q: Q,
  filtros: FetchComisionesFiltros,
): Q {
  let out = q;
  if (filtros.vendedora_id && filtros.vendedora_id !== "todas") {
    out = out.eq("vendedora_id", filtros.vendedora_id);
  }
  if (filtros.estado && filtros.estado !== "todos") {
    out = out.eq("estado", filtros.estado);
  }
  const rango = rangoMesMx(filtros.periodo);
  if (rango) out = out.gte("created_at", rango.desde).lt("created_at", rango.hasta);
  return out;
}
