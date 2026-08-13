/**
 * Mensajes amigables de los códigos `LC_REFACT_*` del caso de refacturación
 * a otro receptor (cancelación de REP, nueva factura y reasignación de pago).
 */
export const LC_CODE_MESSAGES_REFACTURACION: Record<string, string> = {
  LC_REFACT_FORBIDDEN:
    "Sólo un administrador de la organización o el contador puede operar casos de refacturación.",
  LC_REFACT_RUTA: "La ruta fiscal debe ser 01 (sustitución) o 02 (factura nueva sin relación).",
  LC_REFACT_FACTURA_NO_ENCONTRADA: "La factura del caso ya no existe.",
  LC_REFACT_FACTURA_NO_TIMBRADA:
    "La factura debe estar timbrada y vigente para continuar con la refacturación.",
  LC_REFACT_FACTURA_NO_VIVA:
    "La factura ya está cancelada, sustituida o sigue en borrador: no se puede refacturar.",
  LC_REFACT_FACTURA_OTRA_ORG: "La factura pertenece a otra organización.",
  LC_REFACT_CLIENTE_DESTINO: "El cliente que debe recibir la factura no existe en esta organización.",
  LC_REFACT_MISMO_CLIENTE: "El nuevo receptor es el mismo cliente de la factura original.",
  LC_REFACT_CASO_ABIERTO: "Ya existe un caso de refacturación abierto para esta factura.",
  LC_REFACT_CASO_NO_ENCONTRADO: "El caso de refacturación ya no existe.",
  LC_REFACT_PASO: "El paso del asistente está fuera de rango.",
  LC_REFACT_PAGO_NO_ENCONTRADO: "El pago que se quiere mover ya no existe o fue dado de baja.",
  LC_REFACT_REP_VIVO:
    "Cancela el complemento de pago (REP) antes de mover el pago a la nueva factura.",
  LC_REFACT_SOBREPAGO: "El pago excede el saldo de la factura destino.",
  // Refuerzo fiscal.
  LC_REFACT_RECEPTOR_INCOMPLETO:
    "Al nuevo receptor le faltan datos fiscales (razón social, régimen fiscal o código postal).",
  LC_REFACT_RFC_INVALIDO:
    "El RFC no tiene formato válido del SAT (12 o 13 caracteres) o es un RFC genérico.",
  LC_REFACT_MONEDA:
    "La moneda del pago no coincide con la moneda de la factura destino.",
  LC_REFACT_MONEDA_INCONSISTENTE:
    "La moneda del pago o de la nueva factura no coincide con la factura original.",
  LC_REFACT_IMPUESTOS_INCONSISTENTES:
    "Los impuestos trasladados, las retenciones o las claves del SAT no coinciden con la factura original.",
  LC_REFACT_TOTAL_INCONSISTENTE:
    "El subtotal o el total de la nueva factura no coincide con la factura original.",
  LC_REFACT_TC_REQUERIDO: "Captura el tipo de cambio: la operación no está en pesos.",
  LC_REFACT_SUSTITUCION_FALTANTE:
    "La ruta de sustitución requiere relacionar la nueva factura con el CFDI original.",
  LC_REFACT_SIN_FACTURA_NUEVA: "Todavía no se ha generado la nueva factura del caso.",
  LC_REFACT_ORDENANTE_REQUERIDO:
    "Captura el nombre de la empresa desde la que se recibió el depósito.",
  LC_REFACT_CIERRE_INCONSISTENTE:
    "No se puede cerrar el caso: revisa que la nueva factura esté timbrada, que el pago esté aplicado a ella y que el movimiento bancario quedó conciliado.",
};
