/**
 * Ola 1 — Conciliación comprometido → facturado → pagado por proveedor.
 *
 * El "Historial de operaciones" leía sólo `conceptos_costo` (el presupuesto del
 * expediente), así que un gasto que venía de la cotización se veía igual
 * estuviera facturado por el proveedor o no. Aquí viven los tipos y la
 * matemática pura que la RPC `proveedor_estado_cuenta` alimenta.
 */
import { roundMoney } from "@/lib/financial/financialUtils";

export type EstadoConciliacionPartida =
  | "Por facturar"
  | "Facturado parcial"
  | "Facturado"
  | "Pagado"
  | "Sobrefacturado"
  // Ola 12 · R3BD-06: factura en otra moneda sin TC — montos excluidos de la comparación.
  | "Moneda mixta";

export interface FacturaVinculada {
  factura_id: string;
  folio_interno: string | null;
  folio_proveedor: string | null;
  estado: string | null;
  estado_aprobacion: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  moneda: string | null;
  total: number | null;
}

export interface PartidaEstadoCuenta {
  concepto_costo_id: string;
  embarque_id: string | null;
  expediente: string;
  cliente_nombre: string;
  concepto: string;
  comprometido: number;
  moneda: string;
  estado_liquidacion: string;
  fecha_vencimiento: string | null;
  created_at: string;
  facturado: number;
  pagado: number;
  por_facturar: number;
  facturas: FacturaVinculada[];
  estado_conciliacion: EstadoConciliacionPartida;
  /** Ola 12 · R3BD-06: true cuando parte de lo facturado no pudo convertirse a la moneda del concepto. */
  moneda_mixta_sin_tc?: boolean | null;
  /** Ola 12 · R3BD-06: monto (en moneda de la factura) excluido de la comparación por falta de TC. */
  monto_sin_tc?: number | null;
}

export interface FacturaHuerfana {
  factura_id: string;
  folio_interno: string | null;
  folio_proveedor: string | null;
  fecha_emision: string | null;
  moneda: string;
  monto_sin_vincular: number;
  partidas: number;
}

export interface EstadoCuentaProveedor {
  partidas: PartidaEstadoCuenta[];
  facturas_huerfanas: FacturaHuerfana[];
}

export interface BrechaFacturacion {
  /** Partidas comprometidas sin factura del proveedor (o facturadas de menos). */
  partidasPendientes: number;
  /** Monto por facturar agrupado por moneda nativa (nunca se mezclan divisas). */
  porFacturarPorMoneda: Record<string, number>;
  /** Partidas facturadas por arriba de lo comprometido (>1%). */
  partidasSobrefacturadas: number;
  /** Total de partidas del proveedor. */
  totalPartidas: number;
}

const money = (n: number): number => roundMoney(n);

export function calcularBrechaFacturacion(
  partidas: readonly PartidaEstadoCuenta[],
): BrechaFacturacion {
  const porFacturarPorMoneda: Record<string, number> = {};
  let partidasPendientes = 0;
  let partidasSobrefacturadas = 0;

  for (const p of partidas) {
    if (p.estado_conciliacion === "Sobrefacturado") partidasSobrefacturadas += 1;
    const pendiente = Number(p.por_facturar) || 0;
    if (pendiente <= 0.01) continue;
    partidasPendientes += 1;
    const moneda = (p.moneda || "MXN").toUpperCase();
    porFacturarPorMoneda[moneda] = money((porFacturarPorMoneda[moneda] ?? 0) + pendiente);
  }

  return {
    partidasPendientes,
    porFacturarPorMoneda,
    partidasSobrefacturadas,
    totalPartidas: partidas.length,
  };
}

/** Clases de badge por estado de conciliación (tokens semánticos). */
export function toneEstadoConciliacion(estado: EstadoConciliacionPartida): string {
  switch (estado) {
    case "Pagado":
      return "bg-success/15 text-success border-success/30";
    case "Facturado":
      return "bg-accent/15 text-accent border-accent/30";
    case "Facturado parcial":
      return "bg-warning/15 text-warning border-warning/30";
    case "Sobrefacturado":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "Moneda mixta":
      return "bg-warning/15 text-warning border-warning/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
