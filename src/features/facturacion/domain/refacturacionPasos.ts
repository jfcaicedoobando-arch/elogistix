/**
 * Reglas puras del asistente "Refacturar a otro receptor" (5 pasos).
 *
 * Espejo en UI de los candados que ya aplica la base de datos
 * (`LC_REFACT_*`): aquí sólo se decide si el usuario puede avanzar y qué
 * explicación se le muestra, sin llamadas de red ni React.
 */

export const PASOS_REFACTURACION = [
  "Diagnóstico",
  "Cancelar REP",
  "Nueva factura",
  "Cancelar original",
  "Reasignar pago",
] as const;

export const TOTAL_PASOS_REFACTURACION = PASOS_REFACTURACION.length;

export interface PagoRefacturacion {
  id: string;
  fecha_pago: string;
  monto: number;
  moneda: string;
  monto_aplicado_factura: number | null;
  uuid_rep: string | null;
  estado_rep: string | null;
  rep_cancelado_en: string | null;
}

export interface FacturaRefacturacion {
  id: string;
  numero: string;
  estado: string;
  uuid_fiscal: string | null;
}

/** El pago tiene complemento de pago (REP) timbrado y sin cancelar. */
export function tieneRepVivo(pago: PagoRefacturacion): boolean {
  return Boolean(pago.uuid_rep) && !pago.rep_cancelado_en;
}

export function pagosConRepVivo(pagos: PagoRefacturacion[]): PagoRefacturacion[] {
  return pagos.filter(tieneRepVivo);
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

export interface ContextoPasos {
  casoAbierto: boolean;
  clienteDestinoId: string | null;
  motivo: string;
  pagos: PagoRefacturacion[];
  facturaNueva: FacturaRefacturacion | null;
  original: FacturaRefacturacion | null;
  pagoSeleccionadoId: string | null;
  pagoYaReasignado: boolean;
}

/**
 * Motivo por el que el paso indicado NO puede completarse todavía.
 * `null` significa "listo para continuar".
 */
export function bloqueoPaso(paso: number, ctx: ContextoPasos): string | null {
  if (paso === 1) {
    if (ctx.casoAbierto) return null;
    if (!ctx.clienteDestinoId) return "Selecciona el cliente que debe recibir la factura.";
    if (!ctx.motivo.trim()) return "Describe el motivo de la refacturación.";
    return null;
  }
  if (paso === 2) {
    const vivos = pagosConRepVivo(ctx.pagos);
    if (vivos.length > 0) {
      return vivos.length === 1
        ? "Cancela el complemento de pago (REP) del pago recibido antes de continuar."
        : `Cancela los ${vivos.length} complementos de pago (REP) vivos antes de continuar.`;
    }
    return null;
  }
  if (paso === 3) {
    if (!ctx.facturaNueva) return "Crea el borrador para el cliente destino.";
    if (!facturaNuevaLista(ctx.facturaNueva)) {
      return "Timbra la nueva factura antes de continuar.";
    }
    return null;
  }
  if (paso === 4) {
    if (!originalFueraDeCirculacion(ctx.original)) {
      return "Cancela el CFDI original (o espera la aceptación del SAT) antes de reasignar el pago.";
    }
    return null;
  }
  if (paso === 5) {
    if (ctx.pagoYaReasignado) return null;
    if (!ctx.pagoSeleccionadoId) return "Selecciona el pago que debe moverse a la nueva factura.";
    if (!facturaNuevaLista(ctx.facturaNueva)) return "La nueva factura debe estar timbrada.";
    return null;
  }
  return null;
}

/** Texto de la acción principal por paso. */
export function etiquetaAccionPaso(paso: number, casoAbierto: boolean): string {
  if (paso === 1) return casoAbierto ? "Continuar" : "Abrir caso y continuar";
  if (paso === 2) return "Continuar";
  if (paso === 3) return "Continuar";
  if (paso === 4) return "Continuar";
  return "Reasignar pago y finalizar";
}
