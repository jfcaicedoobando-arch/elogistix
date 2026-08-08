/**
 * Mensajes `LC_*` del dominio financiero: facturas de cliente y proveedor,
 * notas de crédito, pagos, REP, movimientos bancarios y anticipos.
 *
 * Se consume desde `lcCodeMessages.ts` (índice).
 */
export const LC_CODE_MESSAGES_FINANCIERO: Record<string, string> = {
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
  LC_CXP_FACTURA_NO_EXISTE: "La factura de proveedor no existe.",
  LC_CXP_EMBARQUE_NO_EXISTE: "El embarque vinculado no existe.",
  LC_CXP_EMBARQUE_ORG_MISMATCH: "El embarque pertenece a otra organización.",
  LC_CXP_EMBARQUE_CANCELADO:
    "No puedes vincular una factura de proveedor a un embarque cancelado.",
  LC_CXP_SIN_CONCEPTOS: "Captura al menos un concepto antes de aprobar la factura.",
  LC_CXP_DESCUADRE:
    "Los conceptos no cuadran con el total de la factura. Revisa los importes antes de aprobar.",
  LC_CXP_PAGADA_INMUTABLE:
    "La factura ya está pagada. Reversa los pagos antes de modificarla.",
  LC_CXP_REAPERTURA: "No se puede reabrir una factura de proveedor cerrada.",
  LC_CXP_CANCEL_DIRECTA:
    "No se permite cancelar directamente; usa la opción de eliminar/reversar según corresponda.",
  LC_CXP_UUID_NO_VERIFICADO:
    "El UUID del CFDI aún no ha sido verificado con el SAT. Intenta más tarde.",
  LC_CXP_NO_EXISTE: "La factura de proveedor no existe o fue eliminada.",
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

  // ── Pagos (cliente y proveedor) ────────────────────────────────────────
  LC_PAGO_NO_ENCONTRADO: "El pago no existe o fue eliminado.",
  LC_PAGO_FACTURA_INEXISTENTE: "La factura del pago no existe.",
  LC_PAGO_FACTURA_NO_VIVA: "La factura no está en un estado que admita pagos.",
  LC_PAGO_CXP_NO_VIVA: "La factura de proveedor no admite pagos en su estado actual.",
  LC_PAGO_PROV_NO_VIVA: "La factura de proveedor no admite pagos en su estado actual.",
  LC_PAGO_PROV_SOBREPAGO:
    "El pago excede el saldo de la factura de proveedor (incluyendo impuestos).",
  LC_PAGO_SOBREPAGO: "El pago excede el saldo pendiente de la factura.",
  LC_PAGO_EXCEDE_SALDO: "El monto excede el saldo pendiente.",
  LC_PAGO_MONTO_INVALIDO: "El monto del pago no es válido.",
  LC_PAGO_TC_REQUERIDO:
    "Captura el tipo de cambio del día para registrar este pago en divisa distinta a la factura.",
  LC_PAGO_SIN_APROBACION: "El pago requiere aprobación previa.",
  LC_PAGO_SIN_PERMISO: "No tienes permisos para registrar este pago.",
  LC_PAGO_CRUCE_NO_SOPORTADO:
    "Este cruce entre divisas aún no está soportado. Contacta al administrador.",
  LC_PAGO_CON_REP_VIVO:
    "El pago tiene un REP (recibo electrónico) vigente. Cancélalo antes de modificar el pago.",

  // ── REP (recibos electrónicos) ─────────────────────────────────────────
  LC_REP_FACTURA_NO_VIVA: "La factura no admite recibo de pago en su estado actual.",
  LC_REP_FACTURA_SIN_TIMBRAR:
    "La factura debe estar timbrada antes de emitir un REP.",

  // ── Movimientos bancarios / conciliación ───────────────────────────────
  LC_MOVIMIENTO_PAGO_INEXISTENTE: "El pago referenciado no existe.",
  LC_MOVIMIENTO_ORG_MISMATCH: "El movimiento pertenece a otra organización.",
  LC_MOVIMIENTO_DIVISA_MISMATCH:
    "La divisa del movimiento no coincide con la del pago.",
  LC_MOVIMIENTO_DOBLE_VINCULO: "El movimiento ya está vinculado a otro pago.",

  // ── Anticipos ──────────────────────────────────────────────────────────
  LC_ANTICIPO_NO_EXISTE: "El anticipo no existe.",
  LC_ANTICIPO_SIN_ROL: "No tienes permisos para gestionar anticipos.",
  LC_ANTICIPO_SIN_SALDO: "El anticipo no tiene saldo disponible.",
  LC_ANTICIPO_MONTO_INVALIDO: "El monto del anticipo no es válido.",
  LC_ANTICIPO_MOTIVO_REQUERIDO: "Captura el motivo del anticipo.",
  LC_ANTICIPO_YA_CANCELADO: "El anticipo ya está cancelado.",
  LC_ANTICIPO_CON_APLICACIONES:
    "El anticipo tiene aplicaciones registradas. Reversa las aplicaciones antes de continuar.",
  LC_ANTICIPO_FACTURA_INVALIDA: "La factura vinculada al anticipo no es válida.",
  LC_ANTICIPO_ORG_MISMATCH: "El anticipo pertenece a otra organización.",
  LC_ANTICIPO_OTRA_ORG: "El anticipo pertenece a otra organización.",
  LC_ANTICIPO_CANCELADO:
    "El anticipo está cancelado, ya no se puede usar ni modificar.",
  LC_ANTICIPO_EMBARQUE_INVALIDO:
    "El embarque que quieres ligar al anticipo no existe o es de otra organización.",
  LC_ANTICIPO_PROVEEDOR_MISMATCH:
    "El proveedor del anticipo no coincide con el de la factura.",
  LC_ANTICIPO_PROVEEDOR_NO_EXISTE: "El proveedor del anticipo no existe.",
  LC_ANTICIPO_PROVEEDOR_OTRA_ORG: "El proveedor pertenece a otra organización.",

  // ── App-raised (no vienen de la BD) ────────────────────────────────────
  LC_FACTURA_CON_REP_VIVO:
    "La factura tiene un complemento de pago (REP) vivo. Cancela primero el REP para continuar.",
  LC_MOVIMIENTO_YA_VINCULADO:
    "El movimiento bancario ya está vinculado a otro pago. Desvincúlalo antes de reutilizarlo.",

  // ── Tesorería · cuentas bancarias / ejecución de pago (Q-15.2) ─────────
  LC_CUENTA_NO_EXISTE: "La cuenta bancaria no existe o fue eliminada.",
  LC_CUENTA_ORG_MISMATCH: "La cuenta bancaria pertenece a otra organización.",
  LC_PAGO_MONEDA_CUENTA_MISMATCH:
    "La moneda de la cuenta bancaria no coincide con la de la factura.",
  LC_CUENTA_SALDO_INSUFICIENTE:
    "El saldo de la cuenta bancaria es insuficiente para este pago.",

  // ── Divisas / tipo de cambio ───────────────────────────────────────────
  LC_MONEDA_NO_SOPORTADA: "Moneda no soportada por el sistema.",
  LC_TC_REQUERIDO: "Captura el tipo de cambio del día.",
  LC_TC_NO_DISPONIBLE:
    "El tipo de cambio de la factura no está disponible. Refresca antes de emitir la nota de crédito.",
  LC_TC_DOF_NO_DISPONIBLE:
    "No fue posible obtener el tipo de cambio del DOF. Intenta de nuevo en unos segundos.",
  // ── Segregación de funciones (SoD) · Q-04 ──────────────────────────────
  LC_SOD_VIOLATION:
    "Segregación de funciones: quien captura una factura de proveedor no puede aprobarla, y el rol Tesorero no aprueba facturas. Pide la aprobación a Contabilidad o a un administrador.",
  // ── Conciliación de tesorería · CxP ────────────────────────────────────
  LC_CONCILIACION_SIN_ALCANCE:
    "Indica un proveedor o una factura para conciliar la tesorería.",
  // ── Anticipos a proveedor ──────────────────────────────────────────────
  LC_ANTICIPO_CUENTA_REQUERIDA:
    "Selecciona la cuenta bancaria de la que sale el anticipo.",
  LC_ANTICIPO_CUENTA_INVALIDA: "La cuenta bancaria del anticipo no existe.",
  LC_ANTICIPO_CUENTA_OTRA_ORG:
    "La cuenta bancaria pertenece a otra organización.",
  LC_ANTICIPO_CUENTA_DIVISA:
    "La moneda de la cuenta no coincide con la del anticipo.",
  LC_MOVIMIENTO_ANTICIPO_INEXISTENTE:
    "No se encontró el movimiento bancario del anticipo.",

  // ── Pago en lote a proveedor ───────────────────────────────────────────
  LC_LOTE_MINIMO_FACTURAS: "Selecciona al menos dos facturas para pagar en lote.",
  LC_LOTE_MONTO_INVALIDO:
    "El importe del lote debe ser mayor a cero y cubrir los renglones capturados.",
  LC_LOTE_FACTURA_INVALIDA:
    "Una de las facturas del lote no existe o ya no está por pagar.",
  LC_LOTE_PROVEEDOR_NO_EXISTE: "El proveedor del lote no existe.",
  LC_LOTE_PROVEEDOR_OTRA_ORG: "El proveedor pertenece a otra organización.",
  LC_LOTE_SIN_ROL: "No tienes permisos para registrar pagos en lote.",
  LC_LOTE_CUENTA_REQUERIDA:
    "Selecciona la cuenta bancaria de la que sale el pago en lote.",
  LC_LOTE_CUENTA_INVALIDA: "La cuenta bancaria del lote no existe.",
  LC_LOTE_CUENTA_OTRA_ORG: "La cuenta bancaria pertenece a otra organización.",
  LC_LOTE_CUENTA_DIVISA:
    "La moneda de la cuenta no coincide con la del pago en lote.",
  LC_MOVIMIENTO_LOTE_INEXISTENTE:
    "No se encontró el movimiento bancario del pago en lote.",

  // ── Estado de cuenta bancario ──────────────────────────────────────────
  LC_CUENTA_NO_ENCONTRADA: "La cuenta bancaria no existe o fue eliminada.",
  LC_ESTADO_CUENTA_PARAMS:
    "Faltan datos para generar el estado de cuenta (cuenta y rango de fechas).",
  LC_ESTADO_CUENTA_RANGO:
    "El rango de fechas del estado de cuenta es inválido: la fecha inicial debe ser anterior a la final.",
  LC_ESTADO_CUENTA_SIN_ACCESO:
    "No tienes permisos para consultar el estado de cuenta de esta cuenta bancaria.",
  // ── Libro de pagos y detalle del pago ──────────────────────────────────
  LC_LIBRO_PAGOS_PARAMS:
    "Faltan datos para consultar el libro de pagos (rango de fechas).",
  LC_LIBRO_PAGOS_RANGO:
    "El rango de fechas del libro de pagos es inválido: la fecha inicial debe ser anterior a la final.",
  LC_LIBRO_PAGOS_SIN_ORG:
    "Tu usuario no tiene una organización activa para consultar el libro de pagos.",
  LC_PAGO_DETALLE_PARAMS:
    "Faltan datos para abrir el detalle del pago (tipo e identificador).",
  LC_PAGO_DETALLE_TIPO: "El tipo de pago solicitado no es válido.",
  LC_PAGO_DETALLE_NO_ENCONTRADO: "El pago no existe o fue eliminado.",
  LC_PAGO_DETALLE_SIN_ORG:
    "Tu usuario no tiene una organización activa para consultar el detalle del pago.",
  LC_PAGO_DETALLE_SIN_ACCESO: "No tienes permisos para ver el detalle de este pago.",
};
