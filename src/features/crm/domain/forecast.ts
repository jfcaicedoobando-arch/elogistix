/**
 * Lógica pura del forecast/reportes del CRM, extraída de `useForecastReportes`
 * para poder testearla sin tocar Supabase.
 */
import { applyDelta, classifyEtapa, makeBucket } from "./forecastBuckets";

export type EtapaTipo = "abierta" | "ganada" | "perdida";

export interface ForecastBucket {
  key: string;
  label: string;
  moneda: string;
  pipeline: number;
  ponderado: number;
  ganado: number;
  count: number;
}

export interface ForecastTotalesMoneda {
  moneda: string;
  totalPipeline: number;
  totalPonderado: number;
  totalGanado: number;
}

export interface ForecastResumen {
  porMes: ForecastBucket[];
  porVendedor: ForecastBucket[];
  /** Totales sin mezclar monedas: no hay TC histórico canónico. */
  totalesPorMoneda: ForecastTotalesMoneda[];
}

export interface OportunidadRow {
  monto_estimado: number | string | null;
  probabilidad: number | string | null;
  fecha_estimada_cierre: string | null;
  vendedor_email: string | null;
  etapa_id: string | null;
  moneda?: string | null;
}

const MESES = [
  "Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic",
];

export function mesKey(d: string | null): string {
  if (!d) return "Sin fecha";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "Sin fecha";
  // v13.303.84 — leer año/mes en UTC para no colar días fronterizos al mes
  // anterior cuando el runner corre en TZ negativa (America/Mexico_City).
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function mesLabel(k: string): string {
  if (k === "Sin fecha") return k;
  const [y, m] = k.split("-");
  return `${MESES[Number(m) - 1]} ${y}`;
}

export function computeForecast(
  rows: OportunidadRow[],
  etapaTipos: Map<string, EtapaTipo>,
): ForecastResumen {
  const mes = new Map<string, ForecastBucket>();
  const vend = new Map<string, ForecastBucket>();
  const totales = new Map<string, ForecastTotalesMoneda>();

  for (const r of rows) {
    const monto = Number(r.monto_estimado ?? 0) || 0;
    const prob = (Number(r.probabilidad ?? 0) || 0) / 100;
    const ponderado = monto * prob;
    const tipo = r.etapa_id ? etapaTipos.get(r.etapa_id) : undefined;
    const { abierta, ganada } = classifyEtapa(tipo);
    const delta = { abierta, ganada, monto, ponderado };
    const moneda = r.moneda || "MXN";

    const t = totales.get(moneda) ?? { moneda, totalPipeline: 0, totalPonderado: 0, totalGanado: 0 };
    if (abierta) {
      t.totalPipeline += monto;
      t.totalPonderado += ponderado;
    }
    if (ganada) t.totalGanado += monto;
    totales.set(moneda, t);

    const mk = `${mesKey(r.fecha_estimada_cierre)}|${moneda}`;
    const mb = mes.get(mk) ?? makeBucket(mk, mesLabel(mesKey(r.fecha_estimada_cierre)), moneda);
    applyDelta(mb, delta);
    mes.set(mk, mb);

    const vk = `${r.vendedor_email || "Sin asignar"}|${moneda}`;
    const vb = vend.get(vk) ?? makeBucket(vk, r.vendedor_email || "Sin asignar", moneda);
    applyDelta(vb, delta);
    vend.set(vk, vb);
  }

  return {
    porMes: Array.from(mes.values()).sort((a, b) => a.key.localeCompare(b.key)),
    porVendedor: Array.from(vend.values()).sort((a, b) => b.ponderado - a.ponderado),
    totalesPorMoneda: Array.from(totales.values()).sort((a, b) => a.moneda.localeCompare(b.moneda)),
  };
}

export interface ReportesCRM {
  embudo: { etapa: string; cantidad: number }[];
  porFuente: { fuente: string; total: number; convertidos: number; tasa: number }[];
  motivosPerdida: { motivo: string; cantidad: number }[];
}

export interface LeadRow {
  estado: string | null;
  fuente: string | null;
}

export interface OportunidadReporteRow {
  etapa_id: string | null;
  motivo_perdida_id: string | null;
}

export function computeReportesCRM(
  leads: LeadRow[],
  oportunidades: OportunidadReporteRow[],
  etapaInfo: Map<string, { nombre: string; tipo: EtapaTipo }>,
  motivoNombre: Map<string, string>,
): ReportesCRM {
  const embudoMap = new Map<string, number>();
  const motivosMap = new Map<string, number>();

  for (const o of oportunidades) {
    const info = o.etapa_id ? etapaInfo.get(o.etapa_id) : undefined;
    const et = info?.nombre ?? "Sin etapa";
    embudoMap.set(et, (embudoMap.get(et) ?? 0) + 1);
    if (info?.tipo === "perdida" && o.motivo_perdida_id) {
      const nm = motivoNombre.get(o.motivo_perdida_id) ?? "Otro";
      motivosMap.set(nm, (motivosMap.get(nm) ?? 0) + 1);
    }
  }

  const fuenteMap = new Map<string, { total: number; convertidos: number }>();
  for (const l of leads) {
    const f = l.fuente ?? "Otro";
    const c = fuenteMap.get(f) ?? { total: 0, convertidos: 0 };
    c.total += 1;
    if (l.estado === "Convertido") c.convertidos += 1;
    fuenteMap.set(f, c);
  }

  return {
    embudo: Array.from(embudoMap, ([etapa, cantidad]) => ({ etapa, cantidad })),
    porFuente: Array.from(fuenteMap, ([fuente, v]) => ({
      fuente,
      total: v.total,
      convertidos: v.convertidos,
      tasa: v.total ? (v.convertidos / v.total) * 100 : 0,
    })),
    motivosPerdida: Array.from(motivosMap, ([motivo, cantidad]) => ({ motivo, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5),
  };
}
