/**
 * Sistema unificado de tonos para badges/chips del módulo CxP.
 *
 * v13.307.19 · 4 roles semánticos + un dot de color; el fondo siempre es
 * neutral (`bg-muted`) para que un mismo verde/rojo no compita entre dos
 * badges vecinos. Consumido por `<ToneBadge>` y por cualquier badge del
 * módulo Compras/CxP que necesite mantener consistencia visual.
 *
 *   neutral      → terminales fríos (Pagada, Borrador, Cancelada)
 *   info         → en curso (Vigente, Parcial, Emitida)
 *   warning      → requiere acción (Por aprobar, Por vencer, Prog. pago)
 *   destructive  → bloqueante (Vencida, Rechazada, Sustituida)
 *   success      → terminal OK (Aprobada, Validada, Conciliada)
 */
export type ChipTone = "neutral" | "info" | "warning" | "destructive" | "success";

/** Clase del "dot" (6 px) que va delante del texto del chip. */
export const TONE_DOT: Record<ChipTone, string> = {
  neutral: "bg-muted-foreground/60",
  info: "bg-info",
  warning: "bg-warning",
  destructive: "bg-destructive",
  success: "bg-success",
};

/** Color del texto cuando se usa el patrón "línea de estado" (sin chip). */
export const TONE_TEXT: Record<ChipTone, string> = {
  neutral: "text-muted-foreground",
  info: "text-info",
  warning: "text-warning",
  destructive: "text-destructive",
  success: "text-success",
};

/**
 * Clase base para chips secundarios del módulo — outline neutro compacto.
 * Combinar con `<Badge variant="outline" className={CHIP_BASE}>`.
 */
export const CHIP_BASE =
  "text-2xs px-1.5 py-0 h-4 font-normal leading-none bg-muted text-muted-foreground border-transparent inline-flex items-center gap-1";

/**
 * Variante ligeramente más alta para tablas donde el chip acompaña texto
 * de datos (h-5 en vez de h-4). Mismo fondo neutro.
 */
export const CHIP_BASE_MD =
  "text-2xs px-1.5 py-0 h-5 font-normal leading-none bg-muted text-muted-foreground border-transparent inline-flex items-center gap-1";
