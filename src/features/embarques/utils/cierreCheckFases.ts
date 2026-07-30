/**
 * v13.361.0 — Fases del checklist de cierre, ordenadas según el ciclo de vida
 * real del embarque (documentos → operación → costos → facturación → cobranza
 * y pagos → rentabilidad).
 */

export type FaseCierreId =
  | "operacion"
  | "documentos"
  | "costos"
  | "facturacion"
  | "cobranza"
  | "rentabilidad"
  | "otros";

export interface FaseCierre {
  id: FaseCierreId;
  numero: number;
  titulo: string;
}

export const FASES_CIERRE: readonly FaseCierre[] = [
  { id: "documentos", numero: 1, titulo: "Expediente documental" },
  { id: "operacion", numero: 2, titulo: "Operación" },
  { id: "costos", numero: 3, titulo: "Costos y facturas de proveedor" },
  { id: "facturacion", numero: 4, titulo: "Facturación al cliente" },
  { id: "cobranza", numero: 5, titulo: "Cobranza y pagos" },
  { id: "rentabilidad", numero: 6, titulo: "Rentabilidad y comisiones" },
  { id: "otros", numero: 7, titulo: "Otros" },
] as const;

export const getFaseCierre = (id: FaseCierreId): FaseCierre =>
  FASES_CIERRE.find((f) => f.id === id) ?? FASES_CIERRE[FASES_CIERRE.length - 1];
