/**
 * Ola 7 (M7): topes numéricos compartidos por la captura del ERP.
 *
 * Los inputs `type="number"` sólo traían `min={0}`, así que un dedazo podía
 * teclear importes absurdos (999,999,999,999.99) que reventaban al llegar a
 * columnas `numeric(18,4)`. Estos límites son la única fuente de verdad para
 * los `max` de la UI y para los schemas zod de mutación.
 */

/** Importe máximo permitido en cualquier campo de dinero. */
export const MONTO_MAX = 999_999_999.99;

/** Cantidad máxima de piezas/unidades en un concepto. */
export const CANTIDAD_MAX = 1_000_000;

/** Mensaje reutilizable para el tope de importes. */
export const MSG_MONTO_MAX = "excede el máximo permitido (999,999,999.99)";

/** Mensaje reutilizable para el tope de cantidades. */
export const MSG_CANTIDAD_MAX = "excede el máximo permitido (1,000,000)";
