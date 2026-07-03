/**
 * Helper para mapear una proforma a un único "estado unificado" combinando
 * `estado_proforma` y `estado_cliente`. Es el single source of truth para:
 *   - el badge en la tabla (`proformasColumns.tsx`)
 *   - el filtro Estado en la barra de filtros (`ProformasFiltros.tsx`)
 *   - el rank de orden por criticidad
 *
 * Prioridad de estados (menor rank = más urgente arriba en la tabla):
 *   0 rechazada   → cliente rechazó, hay que actuar
 *   1 pendiente   → esperando al cliente
 *   2 aceptada    → cliente ya aceptó, lista para convertir a factura
 *   3 facturada   → ya se convirtió a factura, cerrada
 */
import type { ProformaConFactura } from "@/features/embarques/hooks/useProformas";

export type EstadoUnificadoProforma =
  | "pendiente"
  | "aceptada"
  | "rechazada"
  | "facturada";

export function getEstadoUnificado(p: ProformaConFactura): EstadoUnificadoProforma {
  if (p.estado_proforma === "facturada") return "facturada";
  // SAFE-CAST: `estado_cliente` es columna nueva, aún no está en los tipos generados.
  const ec = (p as unknown as { estado_cliente?: string }).estado_cliente ?? "pendiente";
  if (ec === "rechazada") return "rechazada";
  if (ec === "aceptada") return "aceptada";
  return "pendiente";
}

const RANK: Record<EstadoUnificadoProforma, number> = {
  rechazada: 0,
  pendiente: 1,
  aceptada: 2,
  facturada: 3,
};

export function rankEstadoUnificado(p: ProformaConFactura): number {
  return RANK[getEstadoUnificado(p)];
}

export const ESTADOS_UNIFICADOS: EstadoUnificadoProforma[] = [
  "pendiente",
  "aceptada",
  "rechazada",
  "facturada",
];

export const LABEL_ESTADO_UNIFICADO: Record<EstadoUnificadoProforma, string> = {
  pendiente: "Pendiente cliente",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  facturada: "Facturada",
};
