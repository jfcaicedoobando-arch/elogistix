/**
 * Mensajes amigables de los errores de la RPC `registrar_pago_cliente_lote`.
 * Se separa de `pagoClienteLote.ts` para respetar el límite de 200 líneas.
 */

/** Mensajes amigables para los errores de la RPC. */
export function traducirErrorCobroLote(error: Error): string {
  const m = error.message ?? "";
  if (m.includes("LC_COBRO_LOTE_SIN_ROL")) {
    return "No tienes permisos para registrar cobros en lote.";
  }
  if (m.includes("LC_COBRO_LOTE_EXCEDE_SALDO")) {
    return "Un importe aplicado excede el saldo de su factura. Revisa el reparto.";
  }
  if (m.includes("LC_COBRO_LOTE_FACTURA_INVALIDA")) {
    return "Alguna factura no es del cliente seleccionado o está en otra moneda.";
  }
  if (m.includes("LC_COBRO_LOTE_FACTURA_DUPLICADA")) {
    return "Una factura aparece repetida en el lote. Revisa la selección.";
  }
  if (m.includes("LC_COBRO_LOTE_CUENTA_DIVISA")) {
    return "La cuenta bancaria está en otra moneda que el cobro.";
  }
  if (m.includes("LC_COBRO_LOTE_MINIMO_FACTURAS")) {
    return "Un cobro en lote requiere al menos dos facturas.";
  }
  if (m.includes("LC_COBRO_LOTE_IMPORTE_NO_CUADRA") || m.includes("LC_COBRO_LOTE_IMPORTE_REQUERIDO")) {
    return "El reparto no cuadra con el importe recibido: no se permite sobrante sin asignar.";
  }
  if (m.includes("LC_COBRO_LOTE_DUPLICADO_RECIENTE")) {
    return "Ya registraste un cobro en lote idéntico hace unos minutos (mismo cliente, fecha e importe). Verifica el historial de pagos antes de reintentar.";
  }
  return "No se pudo registrar el cobro en lote.";
}
