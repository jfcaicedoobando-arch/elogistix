/**
 * Lógica pura para la proyección de facturación mensual basada en ETA de embarques.
 * Agrupa filas por expediente, suma venta/costo/profit y consolida estado Facturado/Pendiente.
 */
import { convertirAMXN, type Moneda } from "@/lib/financial/financialUtils";

export type EstadoProyeccion = "Facturado" | "Pendiente";

/** Fila plana traída del backend para un embarque del mes seleccionado. */
export interface FilaProyeccion {
  embarque_id: string;
  expediente: string;
  cliente_nombre: string;
  operador: string;
  eta: string | null;
  contenedor: string | null;
  tipo_cambio_usd: number;
  tipo_cambio_eur: number;
  tiene_proforma: boolean;
  /** ¿Existe al menos una factura con factura_pdf_url para este embarque? */
  tiene_factura_pdf: boolean;
  /** Suma en MXN de conceptos_venta del embarque (ya convertidos). */
  venta_mxn: number;
  /** Suma en MXN de conceptos_costo del embarque (ya convertidos). */
  costo_mxn: number;
}

/** Grupo consolidado por expediente. */
export interface GrupoProyeccion {
  expediente: string;
  cliente_nombre: string;
  operador: string;
  /** ETA representativa (mínima del grupo). */
  eta: string | null;
  contenedores: string[];
  totalContenedores: number;
  ventaMxn: number;
  costoMxn: number;
  profitMxn: number;
  margenPct: number;
  estado: EstadoProyeccion;
  /** Embarques que componen el grupo (para drilldown). */
  embarqueIds: string[];
}

export interface KpisProyeccion {
  totalExpedientes: number;
  facturados: number;
  pendientes: number;
  ventaProyMxn: number;
  ventaFacturadaMxn: number;
  ventaPendienteMxn: number;
  costoTotalMxn: number;
  profitProyMxn: number;
  profitFacturadoMxn: number;
  margenProyPct: number;
  avancePct: number;
}

/** Suma una colección de conceptos convirtiendo a MXN según moneda y TC del embarque. */
export function sumarConceptosEnMxn(
  conceptos: { monto: number; moneda: string }[],
  tcUsd: number,
  tcEur: number,
): number {
  return conceptos.reduce((acc, c) => {
    const moneda = (c.moneda?.toUpperCase() ?? "MXN") as Moneda;
    return acc + convertirAMXN(c.monto, moneda, tcUsd, tcEur);
  }, 0);
}

/** Agrupa filas planas por expediente y consolida totales/estado. */
export function agruparPorExpediente(filas: FilaProyeccion[]): GrupoProyeccion[] {
  const map = new Map<string, GrupoProyeccion>();
  for (const f of filas) {
    const key = f.expediente || `_sin_exp_${f.embarque_id}`;
    const prev = map.get(key);
    if (!prev) {
      const profit = f.venta_mxn - f.costo_mxn;
      map.set(key, {
        expediente: f.expediente || "—",
        cliente_nombre: f.cliente_nombre,
        operador: f.operador,
        eta: f.eta,
        contenedores: f.contenedor ? [f.contenedor] : [],
        totalContenedores: f.contenedor ? 1 : 0,
        ventaMxn: f.venta_mxn,
        costoMxn: f.costo_mxn,
        profitMxn: profit,
        margenPct: f.venta_mxn > 0 ? (profit / f.venta_mxn) * 100 : 0,
        // Estado consolidado: arranca como facturado del embarque actual.
        estado: f.tiene_proforma && f.tiene_factura_pdf ? "Facturado" : "Pendiente",
        embarqueIds: [f.embarque_id],
      });
    } else {
      if (f.contenedor && !prev.contenedores.includes(f.contenedor)) {
        prev.contenedores.push(f.contenedor);
      }
      prev.totalContenedores = prev.contenedores.length || prev.totalContenedores + 1;
      prev.ventaMxn += f.venta_mxn;
      prev.costoMxn += f.costo_mxn;
      prev.profitMxn = prev.ventaMxn - prev.costoMxn;
      prev.margenPct = prev.ventaMxn > 0 ? (prev.profitMxn / prev.ventaMxn) * 100 : 0;
      prev.embarqueIds.push(f.embarque_id);
      // ETA mínima del grupo
      if (f.eta && (!prev.eta || f.eta < prev.eta)) prev.eta = f.eta;
      // Estado: solo "Facturado" si TODOS los embarques cumplen.
      const facturadoEste = f.tiene_proforma && f.tiene_factura_pdf;
      if (!facturadoEste) prev.estado = "Pendiente";
    }
  }
  // Orden por ETA ascendente, luego por expediente.
  return Array.from(map.values()).sort((a, b) => {
    const ea = a.eta ?? "9999-12-31";
    const eb = b.eta ?? "9999-12-31";
    if (ea !== eb) return ea.localeCompare(eb);
    return a.expediente.localeCompare(b.expediente);
  });
}

/** Calcula KPIs agregados sobre los grupos de proyección. */
export function calcularKpisProyeccion(grupos: GrupoProyeccion[]): KpisProyeccion {
  const total = grupos.length;
  const facturados = grupos.filter((g) => g.estado === "Facturado").length;
  const pendientes = total - facturados;
  const ventaProy = grupos.reduce((s, g) => s + g.ventaMxn, 0);
  const ventaFact = grupos.filter((g) => g.estado === "Facturado").reduce((s, g) => s + g.ventaMxn, 0);
  const ventaPend = grupos.filter((g) => g.estado === "Pendiente").reduce((s, g) => s + g.ventaMxn, 0);
  const costoTotal = grupos.reduce((s, g) => s + g.costoMxn, 0);
  const profitProy = ventaProy - costoTotal;
  const profitFact = grupos
    .filter((g) => g.estado === "Facturado")
    .reduce((s, g) => s + g.profitMxn, 0);
  return {
    totalExpedientes: total,
    facturados,
    pendientes,
    ventaProyMxn: ventaProy,
    ventaFacturadaMxn: ventaFact,
    ventaPendienteMxn: ventaPend,
    costoTotalMxn: costoTotal,
    profitProyMxn: profitProy,
    profitFacturadoMxn: profitFact,
    margenProyPct: ventaProy > 0 ? (profitProy / ventaProy) * 100 : 0,
    avancePct: total > 0 ? (facturados / total) * 100 : 0,
  };
}

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
