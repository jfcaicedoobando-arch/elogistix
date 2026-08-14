/**
 * Predicados fiscales del caso de refacturación (estado del CFDI original,
 * de la nueva factura y de los REP). Extraído de `refacturacionPasos.ts`
 * para respetar el límite de 200 líneas.
 */

export interface PagoRefacturacion {
  id: string;
  fecha_pago: string;
  monto: number;
  moneda: string;
  monto_aplicado_factura: number | null;
  uuid_rep: string | null;
  estado_rep: string | null;
  rep_cancelado_en: string | null;
  rep_cancellation_status: string | null;
}

export interface FacturaRefacturacion {
  id: string;
  numero: string;
  estado: string;
  uuid_fiscal: string | null;
  /** Estatus del trámite de cancelación ante el SAT (FacturApi). */
  cancellation_status?: string | null;
}

/** El pago tiene complemento de pago (REP) timbrado y sin cancelar. */
export function tieneRepVivo(pago: PagoRefacturacion): boolean {
  return Boolean(pago.uuid_rep) && !pago.rep_cancelado_en;
}

export function pagosConRepVivo(pagos: PagoRefacturacion[]): PagoRefacturacion[] {
  return pagos.filter(tieneRepVivo);
}

/** REPs vivos cuya cancelación está en verificación con el SAT. */
export function repsEnVerificacion(pagos: PagoRefacturacion[]): PagoRefacturacion[] {
  return pagosConRepVivo(pagos).filter((p) =>
    ["pending", "verifying"].includes(p.rep_cancellation_status ?? ""),
  );
}

/** La factura destino ya está timbrada y vigente: admite recibir el pago. */
export function facturaNuevaLista(factura: FacturaRefacturacion | null): boolean {
  if (!factura) return false;
  if (!factura.uuid_fiscal) return false;
  return !["Borrador", "Cancelada", "Sustituida"].includes(factura.estado);
}

/** La factura original ya salió de circulación fiscal. */
export function originalFueraDeCirculacion(factura: FacturaRefacturacion | null): boolean {
  if (!factura) return false;
  return ["Cancelada", "Sustituida"].includes(factura.estado);
}

/** La cancelación del CFDI original ya se solicitó y está en manos del SAT. */
export function cancelacionOriginalEnTramite(factura: FacturaRefacturacion | null): boolean {
  if (!factura) return false;
  if (originalFueraDeCirculacion(factura)) return false;
  return ["pending", "verifying"].includes(factura.cancellation_status ?? "");
}

/** El SAT rechazó (o dejó expirar) la solicitud de cancelación del original. */
export function cancelacionOriginalRechazada(factura: FacturaRefacturacion | null): boolean {
  if (!factura) return false;
  if (originalFueraDeCirculacion(factura)) return false;
  return ["rejected", "expired"].includes(factura.cancellation_status ?? "");
}
