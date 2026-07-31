/**
 * Fuente única de verdad para mapeos visuales de estado.
 * Consolida color de badge, borde, barra apilada, icono y gradiente.
 *
 * Consumido por:
 * - uiMappings.ts (wrappers legacy: getEstadoColor, getEstadoBorderColor, getEstadoBarColor)
 * - DashboardStatusCards (icon + gradient + glow)
 *
 * Para agregar un nuevo estado de embarque, editar `estadoConfigEmbarques.ts`;
 * los estados de facturación/cotización viven abajo.
 * v13.380.2 — el archivo se dividió para respetar el límite de 200 líneas.
 */
import { DEFAULT_VISUAL, type EstadoVisual } from "./estadoConfigBase";
import { ESTADO_CONFIG_EMBARQUES } from "./estadoConfigEmbarques";

export type { EstadoVisual } from "./estadoConfigBase";

export const ESTADO_CONFIG: Record<string, EstadoVisual> = {
  // ───── Estados de embarque ─────
  ...ESTADO_CONFIG_EMBARQUES,

  // ───── Estados de facturación (v13.307.17: verde solo para terminales OK) ─────
  Borrador: { ...DEFAULT_VISUAL },
  Emitida: { ...DEFAULT_VISUAL, badge: "bg-info/15 text-info border border-info/30" },
  // Pagada: terminal neutro — libera el verde para "Aprobada/Validado/Completo".
  Pagada: { ...DEFAULT_VISUAL, badge: "bg-muted text-muted-foreground border border-border" },
  "Parcialmente pagada": { ...DEFAULT_VISUAL, badge: "bg-info/15 text-info border border-info/30" },
  Vencida: { ...DEFAULT_VISUAL, badge: "bg-destructive/15 text-destructive border border-destructive/30" },
  Cancelada: { ...DEFAULT_VISUAL, badge: "bg-destructive/10 text-destructive border border-destructive/30" },
  Pendiente: { ...DEFAULT_VISUAL, badge: "bg-warning/15 text-warning border border-warning/30" },
  Recibido: { ...DEFAULT_VISUAL, badge: "bg-success/15 text-success border border-success/30" },
  Validado: { ...DEFAULT_VISUAL, badge: "bg-success/15 text-success border border-success/30" },
  Pagado: { ...DEFAULT_VISUAL, badge: "bg-success/15 text-success border border-success/30" },

  // ───── Estados de cotización ─────
  // v13.339.0 (Q-01): solicitudes creadas desde el portal del cliente.
  Solicitada: { ...DEFAULT_VISUAL, badge: "bg-accent/15 text-accent border border-accent/30" },
  Enviada: { ...DEFAULT_VISUAL, badge: "bg-info/15 text-info border border-info/30" },
  Aceptada: { ...DEFAULT_VISUAL, badge: "bg-warning/15 text-warning border border-warning/30" },
  Confirmada: { ...DEFAULT_VISUAL, badge: "bg-success/15 text-success border border-success/30" },
  Rechazada: { ...DEFAULT_VISUAL, badge: "bg-destructive/15 text-destructive border border-destructive/30" },
  "En operación": { ...DEFAULT_VISUAL, badge: "bg-state-operacion/15 text-state-operacion border border-state-operacion/30" },
  Archivada: { ...DEFAULT_VISUAL, badge: "bg-muted text-muted-foreground border border-border" },
};

/** Obtiene la configuración visual de un estado, con fallback seguro. */
export function getEstadoVisual(estado: string): EstadoVisual {
  return ESTADO_CONFIG[estado] ?? DEFAULT_VISUAL;
}
