/**
 * Mensajes amigables de los códigos `LC_*` del cobro en lote de cliente
 * (pago múltiple CxC). Se separa de `lcCodeMessages.financiero.ts` para
 * respetar el límite Power-of-10 de 200 líneas por archivo.
 */
export const LC_CODE_MESSAGES_COBRANZA: Record<string, string> = {
  LC_COBRO_LOTE_MINIMO_FACTURAS:
    "Selecciona al menos dos facturas para registrar un cobro en lote.",
  LC_COBRO_LOTE_MONTO_INVALIDO:
    "El importe del cobro debe ser mayor a cero y cubrir los renglones capturados.",
  LC_COBRO_LOTE_FACTURA_INVALIDA:
    "Una de las facturas del cobro no existe o ya no está por cobrar.",
  LC_COBRO_LOTE_EXCEDE_SALDO:
    "El importe asignado a una factura excede su saldo pendiente.",
  LC_COBRO_LOTE_CLIENTE_NO_EXISTE: "El cliente del cobro en lote no existe.",
  LC_COBRO_LOTE_CLIENTE_OTRA_ORG:
    "El cliente pertenece a otra organización.",
  LC_COBRO_LOTE_SIN_ROL: "No tienes permisos para registrar cobros en lote.",
  LC_COBRO_LOTE_CUENTA_INVALIDA: "La cuenta bancaria del cobro no existe.",
  LC_COBRO_LOTE_CUENTA_OTRA_ORG:
    "La cuenta bancaria pertenece a otra organización.",
  LC_COBRO_LOTE_CUENTA_DIVISA:
    "La moneda de la cuenta no coincide con la del cobro en lote.",
  // Ola 5 · RG4-5/RG4-6.
  LC_COBRO_LOTE_IMPORTE_REQUERIDO:
    "Captura el importe recibido del depósito para registrar el cobro en lote.",
  LC_COBRO_LOTE_IMPORTE_NO_CUADRA:
    "El reparto entre facturas no cuadra con el importe recibido: no se permite dinero sin asignar.",
  LC_COBRO_LOTE_FACTURA_DUPLICADA:
    "Una factura aparece más de una vez en el mismo cobro en lote.",
  LC_MOVIMIENTO_LOTE_COBRO_INEXISTENTE:
    "No se encontró el movimiento bancario del cobro en lote.",
};

