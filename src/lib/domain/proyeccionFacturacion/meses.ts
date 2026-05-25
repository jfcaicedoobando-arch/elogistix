/** Devuelve YYYY-MM-DD del primer y último día del mes (year, month 1-12). */
export function rangoMes(year: number, month: number): { desde: string; hasta: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const desde = `${year}-${pad(month)}-01`;
  const last = new Date(year, month, 0).getDate();
  const hasta = `${year}-${pad(month)}-${pad(last)}`;
  return { desde, hasta };
}

/** Genera lista de meses [{key:'YYYY-MM', label:'Mes Año', year, month}] desde Abril 2026 hasta hoy + 12. */
export function generarMesesDisponibles(hoy = new Date()): {
  key: string;
  label: string;
  year: number;
  month: number;
}[] {
  const inicio = new Date(2026, 3, 1); // Abril 2026 (mes index 3)
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

/** Mes actual en formato YYYY-MM (asegurando ≥ Abril 2026). */
export function mesActualKey(hoy = new Date()): string {
  const min = new Date(2026, 3, 1);
  const ref = hoy < min ? min : hoy;
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
}
