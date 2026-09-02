import { PORTAL_RELATED_MAX } from "@/features/portal/services/limits";

/** Agregado de saldo que devuelve la RPC del portal. */
export interface PortalResumenSaldo {
  pagado?: number | null;
  notasCredito?: number | null;
  saldo?: number | null;
  liquidada?: boolean | null;
  numPagos?: number | null;
  numNotas?: number | null;
}

export interface PortalSaldoDerivado {
  totalPagado: number;
  totalNc: number;
  saldo: number;
  liquidada: boolean;
  hayMovimientos: boolean;
  /** Las listas visibles están topadas aunque los totales sean completos. */
  listaTruncada: boolean;
}

/**
 * Deriva los importes visibles de una factura del portal a partir del agregado
 * completo en base de datos (defecto 7). Extraído del componente para respetar
 * el límite de complejidad (Power of 10).
 */
export function derivarSaldoPortal(
  resumen: PortalResumenSaldo | null | undefined,
  estadoFactura: string | null | undefined,
  numPagosVisibles: number,
  numNotasVisibles: number,
): PortalSaldoDerivado {
  const terminal = estadoFactura === "Pagada" || estadoFactura === "Cancelada";
  return {
    totalPagado: resumen?.pagado ?? 0,
    totalNc: resumen?.notasCredito ?? 0,
    saldo: terminal ? 0 : resumen?.saldo ?? 0,
    liquidada: terminal || (resumen?.liquidada ?? false),
    hayMovimientos: (resumen?.numPagos ?? 0) > 0 || (resumen?.numNotas ?? 0) > 0,
    listaTruncada:
      numPagosVisibles >= PORTAL_RELATED_MAX || numNotasVisibles >= PORTAL_RELATED_MAX,
  };
}
