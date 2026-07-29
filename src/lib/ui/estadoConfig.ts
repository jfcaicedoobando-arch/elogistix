/**
 * Fuente única de verdad para mapeos visuales de estado.
 * Consolida color de badge, borde, barra apilada, icono y gradiente.
 *
 * Consumido por:
 * - uiMappings.ts (wrappers legacy: getEstadoColor, getEstadoBorderColor, getEstadoBarColor)
 * - DashboardStatusCards (icon + gradient + glow)
 *
 * Para agregar un nuevo estado, agregarlo aquí y los consumidores lo soportarán automáticamente.
 */

import type { LucideIcon } from "lucide-react";
import {
  Anchor,
  Ship,
  Container,
  Warehouse,
  PackageCheck,
  FileCheck,
  FileText,
  Loader2,
  MapPin,
  ClipboardCheck,
  Archive,
  XCircle,
} from "lucide-react";

export interface EstadoVisual {
  /** Clases Tailwind completas para Badge (bg + text + border) */
  badge: string;
  /** Clase border-l-* para borde izquierdo de tarjetas */
  borderLeft: string;
  /** Clase bg-* sólida para barras apiladas */
  bar: string;
  /** Icono Lucide representativo */
  icon: LucideIcon;
  /** Clases tailwind para gradiente from-* to-* */
  gradient: string;
  /** Clase border-* sólida (sin border-l) */
  border: string;
  /** Clase text-* asociada */
  text: string;
  /** Clase shadow para glow effect (dashboard cards) */
  glow: string;
}

const DEFAULT_VISUAL: EstadoVisual = {
  badge: "bg-muted text-muted-foreground border border-border",
  borderLeft: "border-l-muted-foreground",
  bar: "bg-muted-foreground",
  icon: FileCheck,
  gradient: "from-muted to-muted/80",
  border: "border-muted-foreground",
  text: "text-muted-foreground",
  glow: "",
};

export const ESTADO_CONFIG: Record<string, EstadoVisual> = {
  // ───── Estados de embarque ─────
  // v13.303.21 — "Cotización" (Propuesta) eliminado del workflow. Se conserva
  // la entrada como fallback visual por si aparece por dato legacy.
  "Cotización": {
    ...DEFAULT_VISUAL,
    badge: "bg-muted text-muted-foreground border border-border",
    icon: FileText,
    gradient: "from-muted to-muted/80",
  },
  "En Proceso": {
    badge: "bg-warning/15 text-warning border border-warning/30",
    borderLeft: "border-l-warning",
    bar: "bg-warning",
    icon: Loader2,
    gradient: "from-warning to-warning/80",
    border: "border-warning",
    text: "text-warning",
    glow: "shadow-[0_0_20px_hsl(var(--warning)/0.25)]",
  },
  "Llegada": {
    badge: "bg-state-arribo/15 text-state-arribo border border-state-arribo/30",
    borderLeft: "border-l-state-arribo",
    bar: "bg-state-arribo",
    icon: MapPin,
    gradient: "from-state-arribo to-state-arribo/80",
    border: "border-state-arribo",
    text: "text-state-arribo",
    glow: "shadow-[0_0_20px_hsl(var(--state-arribo)/0.25)]",
  },
  Confirmado: {
    badge: "bg-info/15 text-info border border-info/30",
    borderLeft: "border-l-info",
    bar: "bg-info",
    icon: Anchor,
    gradient: "from-info to-info/80",
    border: "border-info",
    text: "text-info",
    glow: "shadow-[0_0_20px_hsl(var(--info)/0.25)]",
  },
  "En Tránsito": {
    badge: "bg-warning/15 text-warning border border-warning/30",
    borderLeft: "border-l-warning",
    bar: "bg-warning",
    icon: Ship,
    gradient: "from-warning to-warning/80",
    border: "border-warning",
    text: "text-warning",
    glow: "shadow-[0_0_20px_hsl(var(--warning)/0.25)]",
  },
  Arribo: {
    badge: "bg-state-arribo/15 text-state-arribo border border-state-arribo/30",
    borderLeft: "border-l-state-arribo",
    bar: "bg-state-arribo",
    icon: Container,
    gradient: "from-state-arribo to-state-arribo/80",
    border: "border-state-arribo",
    text: "text-state-arribo",
    glow: "shadow-[0_0_20px_hsl(var(--state-arribo)/0.25)]",
  },
  "En Aduana": {
    badge: "bg-state-aduana/15 text-state-aduana border border-state-aduana/30",
    borderLeft: "border-l-state-aduana",
    bar: "bg-state-aduana",
    icon: Warehouse,
    gradient: "from-state-aduana to-state-aduana/80",
    border: "border-state-aduana",
    text: "text-state-aduana",
    glow: "shadow-[0_0_20px_hsl(var(--state-aduana)/0.25)]",
  },
  Entregado: {
    badge: "bg-success/15 text-success border border-success/30",
    borderLeft: "border-l-success",
    bar: "bg-success",
    icon: PackageCheck,
    gradient: "from-success to-success/80",
    border: "border-success",
    text: "text-success",
    glow: "shadow-[0_0_20px_hsl(var(--success)/0.25)]",
  },
  EIR: {
    badge: "bg-state-eir/15 text-state-eir border border-state-eir/30",
    borderLeft: "border-l-state-eir",
    bar: "bg-state-eir",
    icon: ClipboardCheck,
    gradient: "from-state-eir to-state-eir/80",
    border: "border-state-eir",
    text: "text-state-eir",
    glow: "shadow-[0_0_20px_hsl(var(--state-eir)/0.25)]",
  },
  Cerrado: {
    ...DEFAULT_VISUAL,
    icon: Archive,
  },
  Cancelado: {
    badge: "bg-destructive/15 text-destructive border border-destructive/30",
    borderLeft: "border-l-destructive",
    bar: "bg-destructive",
    icon: XCircle,
    gradient: "from-destructive to-destructive/80",
    border: "border-destructive",
    text: "text-destructive",
    glow: "",
  },

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
