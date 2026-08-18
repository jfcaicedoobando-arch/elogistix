/**
 * Tolerancia canónica (en unidades de moneda) para comparaciones de saldo en
 * pagos/cobros. Unifica los literales dispersos (`0.01`, `0.009`) que la
 * auditoría BUG-15 / FE-15 detectó en `DialogRegistrarPago` y `CobroLoteRenglon`.
 *
 * Medio centavo: absorbe el error de redondeo de centavo al convertir entre
 * monedas o al repartir un cobro en lote, sin permitir sobrepagos reales de
 * ≥ 1 centavo.
 */
export const TOLERANCIA_SOBREPAGO = 0.005;
