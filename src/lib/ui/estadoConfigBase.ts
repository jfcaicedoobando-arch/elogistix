/**
 * Base del mapeo visual de estados: contrato `EstadoVisual` + fallback.
 * Extraído de `estadoConfig.ts` en v13.380.2 (límite de 200 líneas por archivo).
 */
import type { LucideIcon } from "lucide-react";
import { FileCheck } from "lucide-react";

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

export const DEFAULT_VISUAL: EstadoVisual = {
  badge: "bg-muted text-muted-foreground border border-border",
  borderLeft: "border-l-muted-foreground",
  bar: "bg-muted-foreground",
  icon: FileCheck,
  gradient: "from-muted to-muted/80",
  border: "border-muted-foreground",
  text: "text-muted-foreground",
  glow: "",
};
