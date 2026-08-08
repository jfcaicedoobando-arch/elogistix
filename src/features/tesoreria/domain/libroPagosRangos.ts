/**
 * Rangos de fechas del libro maestro de pagos (mes, trimestre, año).
 * Dominio puro: sin red ni React.
 */

export interface RangoPagos {
  desde: string;
  hasta: string;
}

function iso(anio: number, mes0: number, dia: number): string {
  return [
    String(anio).padStart(4, "0"),
    String(mes0 + 1).padStart(2, "0"),
    String(dia).padStart(2, "0"),
  ].join("-");
}

function ultimoDiaDelMes(anio: number, mes0: number): number {
  return new Date(anio, mes0 + 1, 0).getDate();
}

/** Mes calendario de `base` (por defecto, hoy). */
export function rangoMesPagos(base: Date = new Date()): RangoPagos {
  const a = base.getFullYear();
  const m = base.getMonth();
  return { desde: iso(a, m, 1), hasta: iso(a, m, ultimoDiaDelMes(a, m)) };
}

/** Trimestre calendario que contiene a `base`. */
export function rangoTrimestrePagos(base: Date = new Date()): RangoPagos {
  const a = base.getFullYear();
  const inicio = Math.floor(base.getMonth() / 3) * 3;
  const fin = inicio + 2;
  return { desde: iso(a, inicio, 1), hasta: iso(a, fin, ultimoDiaDelMes(a, fin)) };
}

/** Año calendario de `base`. */
export function rangoAnioPagos(base: Date = new Date()): RangoPagos {
  const a = base.getFullYear();
  return { desde: iso(a, 0, 1), hasta: iso(a, 11, 31) };
}
