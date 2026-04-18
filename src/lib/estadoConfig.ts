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
  XCircle,
  CheckCircle2,
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
  Confirmado: {
    badge: "bg-info/15 text-info border border-info/30",
    borderLeft: "border-l-blue-500",
    bar: "bg-info",
    icon: Anchor,
    gradient: "from-info to-info/80",
    border: "border-info",
    text: "text-info",
    glow: "shadow-[0_0_20px_hsl(var(--info)/0.25)]",
  },
  "En Tránsito": {
    badge: "bg-warning/15 text-warning border border-warning/30",
    borderLeft: "border-l-amber-500",
    bar: "bg-warning",
    icon: Ship,
    gradient: "from-warning to-warning/80",
    border: "border-warning",
    text: "text-warning",
    glow: "shadow-[0_0_20px_hsl(var(--warning)/0.25)]",
  },
  Arribo: {
    badge: "bg-cyan-500/15 text-cyan-600 border border-cyan-500/30",
    borderLeft: "border-l-cyan-500",
    bar: "bg-cyan-500",
    icon: Container,
    gradient: "from-cyan-500 to-cyan-500/80",
    border: "border-cyan-500",
    text: "text-cyan-600",
    glow: "shadow-[0_0_20px_rgba(6,182,212,0.25)]",
  },
  "En Aduana": {
    badge: "bg-violet-500/15 text-violet-600 border border-violet-500/30",
    borderLeft: "border-l-violet-500",
    bar: "bg-violet-500",
    icon: Warehouse,
    gradient: "from-violet-500 to-violet-500/80",
    border: "border-violet-500",
    text: "text-violet-600",
    glow: "shadow-[0_0_20px_rgba(139,92,246,0.25)]",
  },
  Entregado: {
    badge: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30",
    borderLeft: "border-l-emerald-500",
    bar: "bg-emerald-500",
    icon: PackageCheck,
    gradient: "from-emerald-500 to-emerald-500/80",
    border: "border-emerald-500",
    text: "text-emerald-600",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.25)]",
  },
  EIR: {
    badge: "bg-orange-500/15 text-orange-600 border border-orange-500/30",
    borderLeft: "border-l-orange-500",
    bar: "bg-orange-500",
    icon: FileCheck,
    gradient: "from-orange-500 to-orange-500/80",
    border: "border-orange-500",
    text: "text-orange-600",
    glow: "shadow-[0_0_20px_rgba(249,115,22,0.25)]",
  },
  Cerrado: {
    ...DEFAULT_VISUAL,
    icon: CheckCircle2,
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

  // ───── Estados de facturación ─────
  Borrador: { ...DEFAULT_VISUAL },
  Emitida: { ...DEFAULT_VISUAL, badge: "bg-info/15 text-info border border-info/30" },
  Pagada: { ...DEFAULT_VISUAL, badge: "bg-success/15 text-success border border-success/30" },
  Vencida: { ...DEFAULT_VISUAL, badge: "bg-destructive/15 text-destructive border border-destructive/30" },
  Cancelada: { ...DEFAULT_VISUAL, badge: "bg-destructive/15 text-destructive border border-destructive/30" },
  Pendiente: { ...DEFAULT_VISUAL, badge: "bg-warning/15 text-warning border border-warning/30" },
  Recibido: { ...DEFAULT_VISUAL, badge: "bg-success/15 text-success border border-success/30" },
  Validado: { ...DEFAULT_VISUAL, badge: "bg-success/15 text-success border border-success/30" },
  Pagado: { ...DEFAULT_VISUAL, badge: "bg-success/15 text-success border border-success/30" },

  // ───── Estados de cotización ─────
  Enviada: { ...DEFAULT_VISUAL, badge: "bg-info/15 text-info border border-info/30" },
  Aceptada: { ...DEFAULT_VISUAL, badge: "bg-warning/15 text-warning border border-warning/30" },
  Confirmada: { ...DEFAULT_VISUAL, badge: "bg-success/15 text-success border border-success/30" },
  Rechazada: { ...DEFAULT_VISUAL, badge: "bg-destructive/15 text-destructive border border-destructive/30" },
  Embarcada: { ...DEFAULT_VISUAL, badge: "bg-indigo-500/15 text-indigo-600 border border-indigo-500/30" },
};

/** Obtiene la configuración visual de un estado, con fallback seguro. */
export function getEstadoVisual(estado: string): EstadoVisual {
  return ESTADO_CONFIG[estado] ?? DEFAULT_VISUAL;
}
