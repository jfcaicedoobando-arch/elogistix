/**
 * Estados de factura considerados "vivos" para efectos de reportería.
 * Excluye `Borrador` (aún no emitida), `Cancelada` (revertida ante SAT) y
 * `Sustituida` (reemplazada por otro CFDI vigente): ninguno debe sumar en
 * KPIs, cartera, EERR, portal cliente ni exportaciones financieras.
 *
 * Cambiar esta lista impacta reportes en toda la app — antes de tocarla,
 * revisar `src/lib/__tests__/facturas-estados-reportes.test.ts`.
 */
export const FACTURA_ESTADOS_VIVOS = [
  "Emitida",
  "Pagada",
  "Parcialmente pagada",
  "Vencida",
] as const;

export type FacturaEstadoVivo = (typeof FACTURA_ESTADOS_VIVOS)[number];
