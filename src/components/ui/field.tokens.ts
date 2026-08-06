/**
 * Tokens de clases compartidas por los controles de formulario.
 *
 * v13.430.0 (Armonización visual global · Ola 3). Antes cada control repetía su
 * propia cadena de clases: `Input`/`Textarea`/`SelectTrigger` coincidían casi
 * por accidente y los pickers MX usaban un anillo de foco distinto
 * (`ring-ring` sólido, sin `border-ring` ni hover). Resultado: en un mismo
 * formulario el foco se veía diferente según el campo.
 *
 * Una sola fuente de verdad para: alto, borde, sombra, hover, anillo de foco y
 * estado deshabilitado.
 */

/** Alto canónico de un control: 44px en móvil (tap target) y 40px en ≥md. */
export const FIELD_HEIGHT_CLASS = "h-11 md:h-10";

/** Superficie: borde, radio, fondo, padding y sombra. */
export const FIELD_SURFACE_CLASS =
  "w-full rounded-md border border-input bg-background px-3 py-2 shadow-sm";

/** Estados interactivos: hover, anillo de foco y deshabilitado. */
export const FIELD_STATE_CLASS =
  "ring-offset-background transition-colors placeholder:text-muted-foreground " +
  "hover:border-ring/40 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring/40 focus-visible:ring-offset-0 focus-visible:border-ring " +
  "disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Variante para Radix (`SelectTrigger`), que expone `:focus` en lugar de
 * `:focus-visible` al abrirse con teclado o mouse.
 */
export const FIELD_STATE_RADIX_CLASS =
  "ring-offset-background transition-colors placeholder:text-muted-foreground " +
  "hover:border-ring/40 focus:outline-none focus:ring-2 focus:ring-ring/40 " +
  "focus:ring-offset-0 focus:border-ring " +
  "disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Variante para contenedores que envuelven un `<input>` (pickers de fecha,
 * campos con chips): el anillo se dibuja con `focus-within`.
 */
export const FIELD_STATE_WITHIN_CLASS =
  "ring-offset-background transition-colors " +
  "hover:border-ring/40 focus-within:ring-2 focus-within:ring-ring/40 " +
  "focus-within:ring-offset-0 focus-within:border-ring";

/** Mensaje de validación inline debajo de un control. */
export const FIELD_ERROR_CLASS = "text-xs text-destructive";
