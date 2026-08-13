/**
 * Dominio puro de la inteligencia del proveedor (Ola 4).
 * Semáforos, desviación presupuesto vs factura, clasificación del comparativo
 * y orden de severidad de alertas. Sin dependencias de red.
 */
import { roundMoney } from "@/lib/financial/financialUtils";

export type Semaforo = "good" | "warn" | "bad" | "neutral";

export interface TopConcepto {
  concepto: string;
  montoMxn: number;
  partidas: number;
}

export interface TopRuta {
  ruta: string;
  montoMxn: number;
  embarques: number;
}

export interface ScorecardProveedor {
  partidasTotal: number;
  partidasFacturadas: number;
  comprometidoMxn: number;
  facturadoMxn: number;
  comprometidoLigadoMxn: number;
  diasFacturacionProm: number | null;
  facturasCount: number;
  ticketPromedioMxn: number | null;
  topConceptos: TopConcepto[];
  topRutas: TopRuta[];
}

export interface PuntoTendencia {
  mes: string;
  comprometido: number;
  facturado: number;
  pagado: number;
}

export interface ComparativoConcepto {
  concepto: string;
  moneda: string;
  unitarioPropio: number;
  opsPropias: number;
  unitarioOtros: number;
  opsOtros: number;
  proveedoresComparados: number;
}

export interface AlertasProveedor {
  cerradosSinFactura: { count: number; montoMxn: number };
  facturasPorVencer: { count: number; montoMxn: number };
  facturasVencidas: { count: number; montoMxn: number };
  saldoPendienteMxn: number;
  bancariosIncompletos: boolean;
  documentosVencidos: number;
  documentosPorVencer: number;
}

export interface InteligenciaProveedor {
  tc: { usdMxn: number | null; eurMxn: number | null; faltante: boolean };
  tipoProveedor: string | null;
  scorecard: ScorecardProveedor;
  tendencia: PuntoTendencia[];
  comparativo: ComparativoConcepto[];
  alertas: AlertasProveedor;
}

/** Muestra mínima por lado para que un comparativo sea publicable. */
export const MIN_OPS_COMPARATIVO = 3;

/** Semáforo de días en facturar lo comprometido: <=7 bien, <=20 medio, >20 tarde. */
export function semaforoDiasFacturacion(dias: number | null): Semaforo {
  if (dias == null) return "neutral";
  if (dias <= 7) return "good";
  if (dias <= 20) return "warn";
  return "bad";
}

export interface Desviacion {
  montoMxn: number;
  pct: number | null;
  semaforo: Semaforo;
  /** true cuando el proveedor factura por encima de lo comprometido. */
  factutaDeMas: boolean;
}

/**
 * Desviación entre lo comprometido y lo facturado, medida SOLO sobre las
 * partidas que ya tienen factura ligada (comparar contra el total incluiría
 * lo que aún no se factura y daría una desviación falsa).
 */
export function calcularDesviacion(s: Pick<ScorecardProveedor, "comprometidoLigadoMxn" | "facturadoMxn">): Desviacion {
  const base = s.comprometidoLigadoMxn;
  const monto = roundMoney(s.facturadoMxn - base);
  const pct = base > 0 ? (monto / base) * 100 : null;
  const abs = pct == null ? null : Math.abs(pct);
  const semaforo: Semaforo =
    abs == null ? "neutral" : abs <= 2 ? "good" : abs <= 10 ? "warn" : "bad";
  return { montoMxn: monto, pct: pct == null ? null : Number(pct.toFixed(1)), semaforo, factutaDeMas: monto > 0 };
}

/** % de partidas comprometidas que ya tienen factura del proveedor. */
export function pctPartidasFacturadas(s: Pick<ScorecardProveedor, "partidasTotal" | "partidasFacturadas">): number | null {
  if (s.partidasTotal <= 0) return null;
  return Number(((s.partidasFacturadas / s.partidasTotal) * 100).toFixed(1));
}

export type VeredictoComparativo = "mas_caro" | "en_linea" | "mas_barato";

export interface ComparativoClasificado extends ComparativoConcepto {
  diffPct: number;
  veredicto: VeredictoComparativo;
}

/**
 * Clasifica el comparativo descartando muestras insuficientes (menos de
 * `MIN_OPS_COMPARATIVO` operaciones por lado) para no publicar conclusiones
 * sin sustento. Orden: primero lo más caro.
 */
export function clasificarComparativo(filas: ComparativoConcepto[]): ComparativoClasificado[] {
  return filas
    .filter((f) => f.opsPropias >= MIN_OPS_COMPARATIVO && f.opsOtros >= MIN_OPS_COMPARATIVO && f.unitarioOtros > 0)
    .map((f) => {
      const diffPct = Number((((f.unitarioPropio - f.unitarioOtros) / f.unitarioOtros) * 100).toFixed(1));
      const veredicto: VeredictoComparativo =
        diffPct > 5 ? "mas_caro" : diffPct < -5 ? "mas_barato" : "en_linea";
      return { ...f, diffPct, veredicto };
    })
    .sort((a, b) => b.diffPct - a.diffPct);
}

export type { SeveridadAlerta, AlertaProveedor } from "./alertasProveedor";
export { construirAlertas } from "./alertasProveedor";

