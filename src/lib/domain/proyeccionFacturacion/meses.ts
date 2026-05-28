/** Devuelve YYYY-MM-DD del primer y último día del mes (year, month 1-12). */
export function rangoMes(year: number, month: number): { desde: string; hasta: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const desde = `${year}-${pad(month)}-01`;
  const last = new Date(year, month, 0).getDate();
  const hasta = `${year}-${pad(month)}-${pad(last)}`;
  return { desde, hasta };
}

/** Genera lista de meses [{key:'YYYY-MM', label:'Mes Año', year, month}] en ventana relativa: 24 meses atrás a 12 adelante respecto a `hoy`. */
export function generarMesesDisponibles(hoy = new Date()): {
  key: string;
  label: string;
  year: number;
  month: number;
}[] {
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 24, 1);
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 12, 1);
  const fmt = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" });
  const out: { key: string; label: string; year: number; month: number }[] = [];
  const cur = new Date(inicio);
  while (cur <= fin) {
    const y = cur.getFullYear();
    const m = cur.getMonth() + 1;
    const key = `${y}-${String(m).padStart(2, "0")}`;
    const label = fmt.format(cur).replace(/^./, (c) => c.toUpperCase());
    out.push({ key, label, year: y, month: m });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

/** Mes actual en formato YYYY-MM. */
export function mesActualKey(hoy = new Date()): string {
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}
