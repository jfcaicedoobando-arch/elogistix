/** Una ausencia de banco no implica conciliación pendiente para efectivo. */
export function esPagoEfectivo(metodo: string | null): boolean {
  return ["efectivo", "01"].includes((metodo ?? "").trim().toLowerCase());
}

export function estadoConciliacionPago(pago: {
  conciliado: boolean;
  metodo_pago: string | null;
  cuenta_bancaria_id: string | null;
  movimiento_id: string | null;
}): "Conciliado" | "Pendiente" | "No aplica" {
  if (pago.conciliado) return "Conciliado";
  if (!pago.cuenta_bancaria_id && !pago.movimiento_id && esPagoEfectivo(pago.metodo_pago)) return "No aplica";
  return "Pendiente";
}
