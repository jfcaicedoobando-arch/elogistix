/**
 * Mensajes `LC_*` del dominio de traspasos bancarios entre cuentas propias.
 *
 * Se consume desde `lcCodeMessages.ts` (índice).
 */
export const LC_CODE_MESSAGES_TRASPASOS: Record<string, string> = {
  LC_TRASPASO_COMISION_INVALIDA:
    "La comisión del traspaso no es válida. Debe ser mayor o igual a cero.",
  LC_TRASPASO_CUENTA_INACTIVA: "La cuenta bancaria seleccionada está inactiva.",
  LC_TRASPASO_CUENTA_INEXISTENTE:
    "Una de las cuentas bancarias no existe o fue eliminada.",
  LC_TRASPASO_INEXISTENTE: "El traspaso no existe o fue eliminado.",
  LC_TRASPASO_MISMA_CUENTA:
    "No puedes trasladar fondos a la misma cuenta de origen.",
  LC_TRASPASO_MONTO_INVALIDO: "El monto del traspaso no es válido.",
  LC_TRASPASO_ORG_DISTINTA:
    "Ambas cuentas deben pertenecer a la misma organización.",
  LC_TRASPASO_TC_REQUERIDO:
    "Captura el tipo de cambio del día para traspasar entre cuentas de distinta moneda.",
  LC_TRASPASO_YA_CANCELADO: "El traspaso ya está cancelado.",

  LC_TRASPASO_SALDO_INSUFICIENTE:
    "El saldo de la cuenta de origen no alcanza para el traspaso más la comisión. Baja el monto o registra primero los depósitos pendientes.",
};
