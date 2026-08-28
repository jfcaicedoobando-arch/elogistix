/**
 * Mensajes `LC_*` del dominio financiero: facturas de cliente y proveedor,
 * notas de crédito, pagos, REP, movimientos bancarios y anticipos.
 *
 * Se consume desde `lcCodeMessages.ts` (índice).
 */
export const LC_CODE_MESSAGES_FINANCIERO: Record<string, string> = {
  // ── Ola 3 · cierre de periodo e inmutabilidad fiscal ───────────────────
  LC_PERIODO_CERRADO:
    "El periodo contable ya está cerrado en esa fecha. Usa una fecha posterior al cierre " +
    "o pide a administración que reabra el periodo en Configuración → Facturación.",
  LC_UUID_FISCAL_INMUTABLE:
    "La factura ya tiene folio fiscal (UUID) asignado y no puede cambiarse.",
  LC_CONCEPTO_PROFORMADO:
    "El concepto ya está incluido en una proforma. Libéralo de la proforma antes de editarlo o eliminarlo.",
  LC_PROFORMA_EMBARQUE_AJENO:
    "Todas las proformas a consolidar deben pertenecer al mismo embarque.",
  // ── Facturas cliente (CxC) ─────────────────────────────────────────────
  LC_FACTURA_NO_ENCONTRADA: "La factura no existe o fue eliminada.",
  LC_FAC_ESTADO_CALCULADO:
    "El estado de la factura se calcula automáticamente y no puede modificarse manualmente.",
  LC_FAC_REAPERTURA: "No es posible reabrir una factura ya cerrada.",
  LC_FAC_CANCEL_CON_PAGOS:
    "No se puede cancelar una factura que tiene pagos aplicados. Reversa los pagos primero.",
  LC_CERRAR_FACTURA_SIN_ROL: "No tienes permisos para cerrar facturas.",
  LC_SUSTITUCION_CICLO:
    "La sustitución generaría un ciclo entre facturas. Revisa las relaciones.",

  // ── Notas de crédito (cliente) ─────────────────────────────────────────
  LC_NC_INMUTABLE: "La nota de crédito ya fue emitida y no puede modificarse.",
  LC_NC_EXCEDE_SALDO:
    "El monto de la nota de crédito excede el saldo disponible de la factura.",

  // ── Facturas de proveedor (CxP) ────────────────────────────────────────
  LC_FACTURA_PROVEEDOR_NOT_FOUND: "La factura de proveedor no existe.",
  LC_FACTURA_PROV_NO_ENCONTRADA: "La factura de proveedor no existe o fue eliminada.",
  LC_EMBARQUE_AJENO:
    "El expediente indicado no pertenece a esta organización o fue eliminado.",
  LC_FACTURA_PROVEEDOR_NO_ENCONTRADA: "La factura de proveedor no existe o fue eliminada.",
  LC_CXP_FACTURA_NO_EXISTE: "La factura de proveedor no existe.",
  LC_CXP_EMBARQUE_NO_EXISTE: "El embarque vinculado no existe.",
  LC_CXP_EMBARQUE_ORG_MISMATCH: "El embarque pertenece a otra organización.",
  LC_CXP_EMBARQUE_CANCELADO:
    "No puedes vincular una factura de proveedor a un embarque cancelado.",
  LC_CXP_SIN_CONCEPTOS: "Captura al menos un concepto antes de aprobar la factura.",
  LC_CXP_DESCUADRE:
    "Los conceptos capturados no suman el subtotal de la factura. Revisa el precio " +
    "unitario (captúralo con los decimales del CFDI) y las cantidades, o elimina las " +
    "partidas que no correspondan.",

  LC_CXP_PAGADA_INMUTABLE:
    "La factura ya está pagada. Reversa los pagos antes de modificarla.",
  LC_CXP_REAPERTURA: "No se puede reabrir una factura de proveedor cerrada.",
  LC_CXP_CANCEL_DIRECTA:
    "No se permite cancelar directamente; usa la opción de eliminar/reversar según corresponda.",
  LC_CXP_UUID_NO_VERIFICADO:
    "El UUID del CFDI aún no ha sido verificado con el SAT. Intenta más tarde.",
  LC_CXP_NO_EXISTE: "La factura de proveedor no existe o fue eliminada.",
  LC_CXP_RECHAZO_CON_PAGOS:
    "Esta factura ya tiene pagos aplicados. Anula o reversa los pagos antes de rechazarla.",

  LC_CXP_TOTAL_NEGATIVO: "El total de la factura de proveedor no puede ser negativo.",
  LC_CXP_TOTAL_MENOR_PAGADO:
    "El total no puede quedar por debajo de lo ya pagado. Cancela o ajusta los pagos primero.",
  LC_EERR_FUENTE_INVALIDA:
    "La fuente del Estado de Resultados debe ser 'facturas' o 'embarques'.",

  // ── NC de proveedor ────────────────────────────────────────────────────
  LC_NC_PROV_ESTADO_TERMINAL: "La nota de crédito ya está en un estado final.",
  LC_NC_PROV_INSERT_ESTADO_INVALIDO:
    "El estado inicial de la nota de crédito no es válido.",
  LC_NC_PROV_TRANSICION_INVALIDA:
    "La nota de crédito no puede pasar a ese estado desde el actual.",

  LC_FACTURA_SIN_TC_DOF:
    "No hay tipo de cambio DOF publicado para esa moneda y fecha. Captúralo antes de generar la factura.",

};