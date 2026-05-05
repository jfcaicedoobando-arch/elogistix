/**
 * Lógica pura para la proyección de facturación mensual basada en ETA de embarques.
 * Agrupa filas por expediente, suma venta/costo/profit y consolida estado
 * Facturado / Pendiente / Hueco (ETD+5 ya pasó y no se ha facturado).
 */
import { convertirAMXN, type Moneda } from "@/lib/financial/financialUtils";

/** Estados consolidados a nivel grupo (expediente). */
export type EstadoProyeccion = "Facturado" | "Pendiente" | "Hueco";

/** Días después del ETD a partir de los cuales un embarque sin factura se considera "Hueco". */
export const DIAS_HUECO = 5;

/** Fila plana traída del backend para un embarque del mes seleccionado. */
export interface FilaProyeccion {
  embarque_id: string;
  expediente: string;
  cliente_nombre: string;
  operador: string;
  etd: string | null;
  eta: string | null;
  contenedor: string | null;
  tipo_cambio_usd: number;
  tipo_cambio_eur: number;
  tiene_proforma: boolean;
  /** ¿Existe al menos una factura con factura_pdf_url para este embarque? */
  tiene_factura_pdf: boolean;
  venta_mxn: number;
  venta_usd: number;
  costo_mxn: number;
  costo_usd: number;
}

/** Grupo consolidado por expediente. */
export interface GrupoProyeccion {
  expediente: string;
  cliente_nombre: string;
  operador: string;
  /** ETD representativa (mínima del grupo). */
  etd: string | null;
  /** ETA representativa (mínima del grupo). */
  eta: string | null;
  contenedores: string[];
  totalContenedores: number;
  ventaMxn: number;
  ventaUsd: number;
  costoMxn: number;
  costoUsd: number;
  profitMxn: number;
  profitUsd: number;
  margenPct: number;
  /** Estado consolidado: Facturado | Pendiente | Hueco. */
  estado: EstadoProyeccion;
  /** Días transcurridos desde ETD (sólo si está sin facturar y ETD ya pasó). */
  diasDesdeEtd: number | null;
  embarqueIds: string[];
}

export interface KpisProyeccion {
  totalExpedientes: number;
  facturados: number;
  pendientes: number;
  huecos: number;
  // MXN
  ventaProyMxn: number;
  ventaFacturadaMxn: number;
  ventaPendienteMxn: number;
  ventaHuecoMxn: number;
  costoTotalMxn: number;
  profitProyMxn: number;
  profitFacturadoMxn: number;
  // USD
  ventaProyUsd: number;
  ventaFacturadaUsd: number;
  ventaPendienteUsd: number;
  ventaHuecoUsd: number;
  costoTotalUsd: number;
  profitProyUsd: number;
  // Derivados
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

/** Suma una colección de conceptos convirtiendo a USD según moneda y TC del embarque. */
export function sumarConceptosEnUsd(
  conceptos: { monto: number; moneda: string }[],
  tcUsd: number,
  tcEur: number,
): number {
  if (!tcUsd || tcUsd <= 0) return 0;
  return conceptos.reduce((acc, c) => {
    const moneda = (c.moneda?.toUpperCase() ?? "MXN") as Moneda;
    if (moneda === "USD") return acc + c.monto;
    if (moneda === "EUR") return acc + (c.monto * tcEur) / tcUsd;
    return acc + c.monto / tcUsd; // MXN
  }, 0);
}

/** Calcula días enteros transcurridos desde una fecha YYYY-MM-DD hasta `hoy`. */
function diasDesde(fecha: string | null, hoy: Date): number | null {
  if (!fecha) return null;
  const d = new Date(`${fecha}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  const ms = hoy.getTime() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Agrupa filas planas por expediente y consolida totales/estado. */
export function agruparPorExpediente(
  filas: FilaProyeccion[],
  hoy: Date = new Date(),
): GrupoProyeccion[] {
  const map = new Map<string, GrupoProyeccion>();
  for (const f of filas) {
    const key = f.expediente || `_sin_exp_${f.embarque_id}`;
    const prev = map.get(key);
    if (!prev) {
      const profitMxn = f.venta_mxn - f.costo_mxn;
      const profitUsd = f.venta_usd - f.costo_usd;
      map.set(key, {
        expediente: f.expediente || "—",
        cliente_nombre: f.cliente_nombre,
        operador: f.operador,
        etd: f.etd,
        eta: f.eta,
        contenedores: f.contenedor ? [f.contenedor] : [],
        totalContenedores: f.contenedor ? 1 : 0,
        ventaMxn: f.venta_mxn,
        ventaUsd: f.venta_usd,
        costoMxn: f.costo_mxn,
        costoUsd: f.costo_usd,
        profitMxn,
        profitUsd,
        margenPct: f.venta_mxn > 0 ? (profitMxn / f.venta_mxn) * 100 : 0,
        estado: f.tiene_proforma && f.tiene_factura_pdf ? "Facturado" : "Pendiente",
        diasDesdeEtd: null,
        embarqueIds: [f.embarque_id],
      });
    } else {
      if (f.contenedor && !prev.contenedores.includes(f.contenedor)) {
        prev.contenedores.push(f.contenedor);
      }
      prev.totalContenedores = prev.contenedores.length || prev.totalContenedores + 1;
      prev.ventaMxn += f.venta_mxn;
      prev.ventaUsd += f.venta_usd;
      prev.costoMxn += f.costo_mxn;
      prev.costoUsd += f.costo_usd;
      prev.profitMxn = prev.ventaMxn - prev.costoMxn;
      prev.profitUsd = prev.ventaUsd - prev.costoUsd;
      prev.margenPct = prev.ventaMxn > 0 ? (prev.profitMxn / prev.ventaMxn) * 100 : 0;
      prev.embarqueIds.push(f.embarque_id);
      if (f.etd && (!prev.etd || f.etd < prev.etd)) prev.etd = f.etd;
      if (f.eta && (!prev.eta || f.eta < prev.eta)) prev.eta = f.eta;
      const facturadoEste = f.tiene_proforma && f.tiene_factura_pdf;
      if (!facturadoEste) prev.estado = "Pendiente";
    }
  }
  // Pasada final: marcar "Hueco" si pendiente y ETD+DIAS_HUECO ya pasó.
  const grupos = Array.from(map.values());
  for (const g of grupos) {
    if (g.estado === "Pendiente") {
      const dias = diasDesde(g.etd, hoy);
      g.diasDesdeEtd = dias;
      if (dias !== null && dias > DIAS_HUECO) {
        g.estado = "Hueco";
      }
    }
  }
  return grupos.sort((a, b) => {
    const ea = a.eta ?? "9999-12-31";
    const eb = b.eta ?? "9999-12-31";
    if (ea !== eb) return ea.localeCompare(eb);
    return a.expediente.localeCompare(b.expediente);
  });
}

/** Calcula KPIs agregados sobre los grupos de proyección. */
export function calcularKpisProyeccion(grupos: GrupoProyeccion[]): KpisProyeccion {
  const total = grupos.length;
  const facturadosArr = grupos.filter((g) => g.estado === "Facturado");
  const pendientesArr = grupos.filter((g) => g.estado === "Pendiente");
  const huecosArr = grupos.filter((g) => g.estado === "Hueco");

  // Para KPIs MXN/USD "pendiente" agrupamos pendiente + hueco (ambos sin facturar).
  const sinFacturarArr = [...pendientesArr, ...huecosArr];

  const sumMxn = (arr: GrupoProyeccion[]) => arr.reduce((s, g) => s + g.ventaMxn, 0);
  const sumUsd = (arr: GrupoProyeccion[]) => arr.reduce((s, g) => s + g.ventaUsd, 0);

  const ventaProyMxn = sumMxn(grupos);
  const ventaProyUsd = sumUsd(grupos);
  const costoTotalMxn = grupos.reduce((s, g) => s + g.costoMxn, 0);
  const costoTotalUsd = grupos.reduce((s, g) => s + g.costoUsd, 0);
  const profitProyMxn = ventaProyMxn - costoTotalMxn;
  const profitProyUsd = ventaProyUsd - costoTotalUsd;
  const profitFactMxn = facturadosArr.reduce((s, g) => s + g.profitMxn, 0);

  return {
    totalExpedientes: total,
    facturados: facturadosArr.length,
    pendientes: pendientesArr.length,
    huecos: huecosArr.length,
    ventaProyMxn,
    ventaFacturadaMxn: sumMxn(facturadosArr),
    ventaPendienteMxn: sumMxn(sinFacturarArr),
    ventaHuecoMxn: sumMxn(huecosArr),
    costoTotalMxn,
    profitProyMxn,
    profitFacturadoMxn: profitFactMxn,
    ventaProyUsd,
    ventaFacturadaUsd: sumUsd(facturadosArr),
    ventaPendienteUsd: sumUsd(sinFacturarArr),
    ventaHuecoUsd: sumUsd(huecosArr),
    costoTotalUsd,
    profitProyUsd,
    margenProyPct: ventaProyMxn > 0 ? (profitProyMxn / ventaProyMxn) * 100 : 0,
    avancePct: total > 0 ? (facturadosArr.length / total) * 100 : 0,
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
  const inicio = new Date(2026, 3, 1);
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
