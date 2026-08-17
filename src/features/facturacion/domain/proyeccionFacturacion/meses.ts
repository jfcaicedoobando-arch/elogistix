/** Devuelve YYYY-MM-DD del primer y último día del mes (year, month 1-12). */
export function rangoMes(year: number, month: number): { desde: string; hasta: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const desde = `${year}-${pad(month)}-01`;
  const last = new Date(year, month, 0).getDate();
  const hasta = `${year}-${pad(month)}-${pad(last)}`;
  return { desde, hasta };
}

const NOMBRES_MES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Etiqueta "Mes Año" a partir de valores numéricos año/mes (1-12), sin pasar
 * por `Date` + conversión de zona horaria. Bug conocido: construir la fecha
 * con `new Date(y, m, 1)` y luego formatear forzando TZ México podía correr
 * el mes mostrado cuando el runtime corría en otra zona horaria (p. ej. UTC).
 */
export function labelMes(year: number, month: number): string {
  const nombre = NOMBRES_MES_ES[month - 1] ?? "";
  const capitalizado = nombre.charAt(0).toUpperCase() + nombre.slice(1);
  return `${capitalizado} ${year}`;
}

/** Etiqueta "Mes Año" a partir de la clave `YYYY-MM`. */
export function labelMesDesdeKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return labelMes(year, month);
}

/** Genera lista de meses [{key:'YYYY-MM', label:'Mes Año', year, month}] en ventana relativa: 24 meses atrás a 12 adelante respecto a `hoy`. */
export function generarMesesDisponibles(hoy = new Date()): {
  key: string;
  label: string;
  year: number;
  month: number;
}[] {
  // Se usa sólo para derivar año/mes base; nunca se formatea ni se convierte
  // de zona horaria a partir de estos objetos `Date`.
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 24, 1);
  const totalMeses = 37; // 24 atrás + mes actual + 12 adelante
  const out: { key: string; label: string; year: number; month: number }[] = [];
  let y = inicio.getFullYear();
  let m = inicio.getMonth() + 1; // 1-12
  for (let i = 0; i < totalMeses; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ key, label: labelMes(y, m), year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Mes actual en formato YYYY-MM. */
export function mesActualKey(hoy = new Date()): string {
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}
