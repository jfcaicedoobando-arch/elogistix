/**
 * Filtros y ordenamiento (lógica pura) de la bitácora de tesorería.
 *
 * Permite acotar los movimientos por rango de fechas, tipo de movimiento
 * (pago registrado / pago eliminado) y usuario, además de ordenarlos por
 * fecha ascendente o descendente.
 */

export type TipoMovimientoBitacora = "todos" | "pagar" | "editar_pago" | "eliminar_pago";
export type OrdenBitacora = "reciente" | "antiguo";

export interface FiltrosBitacoraTesoreria {
  /** ISO YYYY-MM-DD o cadena vacía */
  desde: string;
  /** ISO YYYY-MM-DD o cadena vacía */
  hasta: string;
  tipo: TipoMovimientoBitacora;
  /** email del usuario/operador, o "todos" */
  usuario: string;
  orden: OrdenBitacora;
}

export const FILTROS_BITACORA_TESORERIA_INICIALES: FiltrosBitacoraTesoreria = {
  desde: "",
  hasta: "",
  tipo: "todos",
  usuario: "todos",
  orden: "reciente",
};

export const TIPO_MOVIMIENTO_LABELS: Record<TipoMovimientoBitacora, string> = {
  todos: "Todos los movimientos",
  pagar: "Pago registrado",
  editar_pago: "Pago editado",
  eliminar_pago: "Pago eliminado",
};

export const ORDEN_BITACORA_LABELS: Record<OrdenBitacora, string> = {
  reciente: "Más reciente primero",
  antiguo: "Más antiguo primero",
};

interface EntradaFiltrable {
  accion: string;
  created_at: string;
  usuario_email: string;
}

/** Convierte un timestamp a fecha ISO (YYYY-MM-DD) para comparar rangos. */
function fechaIso(createdAt: string): string {
  return createdAt.slice(0, 10);
}

/** Lista ordenada de usuarios/operadores presentes en la bitácora. */
export function usuariosBitacora<T extends EntradaFiltrable>(entradas: readonly T[]): string[] {
  const set = new Set<string>();
  for (const e of entradas) {
    if (e.usuario_email) set.add(e.usuario_email);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es-MX"));
}

/** ¿El usuario acotó la bitácora respecto al estado inicial? */
export function hayFiltrosBitacoraActivos(filtros: FiltrosBitacoraTesoreria): boolean {
  return (
    filtros.desde !== "" ||
    filtros.hasta !== "" ||
    filtros.tipo !== "todos" ||
    filtros.usuario !== "todos"
  );
}

/** Aplica filtros y ordenamiento sobre las entradas de bitácora. */
export function filtrarOrdenarBitacoraTesoreria<T extends EntradaFiltrable>(
  entradas: readonly T[],
  filtros: FiltrosBitacoraTesoreria,
): T[] {
  const filtradas = entradas.filter((e) => {
    if (filtros.tipo !== "todos" && e.accion !== filtros.tipo) return false;
    if (filtros.usuario !== "todos" && e.usuario_email !== filtros.usuario) return false;
    const dia = fechaIso(e.created_at);
    if (filtros.desde && dia < filtros.desde) return false;
    if (filtros.hasta && dia > filtros.hasta) return false;
    return true;
  });

  const signo = filtros.orden === "reciente" ? -1 : 1;
  return filtradas.sort((a, b) => signo * a.created_at.localeCompare(b.created_at));
}

/** Descripción legible de los filtros aplicados (para el PDF exportado). */
export function descripcionFiltrosBitacora(filtros: FiltrosBitacoraTesoreria): string {
  const partes: string[] = [];
  if (filtros.desde) partes.push(`desde ${filtros.desde.split("-").reverse().join("/")}`);
  if (filtros.hasta) partes.push(`hasta ${filtros.hasta.split("-").reverse().join("/")}`);
  if (filtros.tipo !== "todos") partes.push(TIPO_MOVIMIENTO_LABELS[filtros.tipo]);
  if (filtros.usuario !== "todos") partes.push(`usuario ${filtros.usuario}`);
  const orden = ORDEN_BITACORA_LABELS[filtros.orden].toLowerCase();
  if (partes.length === 0) return `Todos los movimientos · ${orden}`;
  return `Filtros: ${partes.join(" · ")} · ${orden}`;
}
