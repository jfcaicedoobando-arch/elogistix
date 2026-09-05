/**
 * Helper para mapear una proforma a un único "estado unificado" combinando
 * `estado_proforma` y `estado_cliente`. Es el single source of truth para:
 *   - el badge en la tabla (`proformasColumns.tsx`)
 *   - el filtro Estado en la barra de filtros (`ProformasFiltros.tsx`)
 *   - el rank de orden por criticidad
 *
 * Promovido a `lib/domain/` en el Bloque 2.3 (arquitectura). Antes vivía en
 * `features/proformas/lib/` y era consumido por 4 archivos de `facturacion`.
 * La firma es estructural (no importa el tipo `ProformaConFactura` para no
 * invertir la jerarquía lib → features).
 *
 * Prioridad de estados (menor rank = más urgente arriba en la tabla):
 *   0 rechazada   → cliente rechazó, hay que actuar
 *   1 pendiente   → esperando al cliente
 *   2 aceptada    → cliente ya aceptó, lista para convertir a factura
 *   3 facturada   → ya se convirtió a factura, cerrada
 */

export type EstadoUnificadoProforma =
  | "pendiente"
  | "aceptada"
  | "rechazada"
  | "facturada";

/** Forma mínima requerida — cualquier proforma con estos dos campos sirve. */
export interface ProformaEstadoInput {
  estado_proforma?: string | null;
  estado_cliente?: string | null;
  /**
   * P2 (auditoría v13.823.143 · bug 2): una proforma con factura vinculada ya
   * está facturada aunque `estado_proforma` no se haya sincronizado; sin esto
   * seguía contándose en "Por emitir".
   */
  factura_id?: string | null;
}

export function getEstadoUnificado(p: ProformaEstadoInput): EstadoUnificadoProforma {
  if (p.estado_proforma === "facturada" || p.factura_id) return "facturada";
  const ec = p.estado_cliente ?? "pendiente";
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

export function rankEstadoUnificado(p: ProformaEstadoInput): number {
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
