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

  // ── Pagos (cliente y proveedor) ────────────────────────────────────────
  LC_PAGO_NO_ENCONTRADO: "El pago no existe o fue eliminado.",
  LC_PAGO_FACTURA_INEXISTENTE: "La factura del pago no existe.",
  LC_PAGO_FACTURA_NO_VIVA: "La factura no está en un estado que admita pagos.",
  LC_FACTURA_EN_CANCELACION:
    "La factura tiene una cancelación en trámite ante el SAT: no se pueden registrar cobros hasta que el SAT resuelva la solicitud.",
  LC_PAGO_CXP_NO_VIVA: "La factura de proveedor no admite pagos en su estado actual.",
  LC_PAGO_PROV_NO_VIVA: "La factura de proveedor no admite pagos en su estado actual.",
  LC_PAGO_PROV_SOBREPAGO:
    "El pago excede el saldo de la factura de proveedor (incluyendo impuestos).",
  LC_PAGO_SOBREPAGO: "El pago excede el saldo pendiente de la factura.",
  // Ola 1 (major release): espejo de LC_LOTE_FECHA_FUTURA en el cobro individual.
  LC_PAGO_FECHA_FUTURA: "La fecha del cobro no puede ser futura.",
  LC_FACTURA_REQUERIDA: "Falta indicar la factura sobre la que se opera.",
  LC_FACTURA_NO_EXISTE: "La factura no existe o fue eliminada.",
  LC_PAGO_PROGRAMADO_EN_PROCESO:
    "Este pago programado ya se está procesando. Espera unos segundos y verifica antes de reintentar.",
  LC_TC_DOF_FORBIDDEN:
    "El tipo de cambio DOF es un catálogo global de la plataforma: sólo un super administrador puede capturarlo.",
  LC_TC_DOF_INVALIDO: "El tipo de cambio USD debe ser mayor a cero.",
  LC_TC_DOF_FECHA_INVALIDA: "La fecha del tipo de cambio no puede ser futura.",
  LC_PAGO_EXCEDE_SALDO: "El monto excede el saldo pendiente.",
  LC_PAGO_MONTO_INVALIDO: "El monto del pago no es válido.",
  LC_PAGO_TC_REQUERIDO:
    "Captura el tipo de cambio del día para registrar este pago en divisa distinta a la factura.",
  // Ola 11 · RNF-10
  LC_CUENTA_MONEDA_CON_MOVIMIENTOS:
    "La cuenta ya tiene movimientos registrados: la moneda no se puede cambiar.",
  // Ola 11 · lotes (CxC / CxP)
  LC_COBRO_LOTE_EN_PROCESO:
    "El cobro en lote aún se está procesando. Espera unos segundos antes de reintentar.",
  LC_COBRO_LOTE_FECHA_FUTURA: "La fecha del cobro no puede ser futura.",
  LC_COBRO_LOTE_FECHA_PREVIA_EMISION:
    "La fecha del cobro es anterior a la emisión de una de las facturas del lote.",
  LC_COBRO_LOTE_TC_REQUERIDO:
    "Captura el tipo de cambio del lote para cobros en dólares o euros.",
  LC_CXP_APROBACION_DIRECTA:
    "La aprobación de facturas de proveedor sólo puede cambiarse desde el flujo de aprobación.",
  LC_LOTE_FACTURA_DUPLICADA: "Una factura aparece repetida en el lote. Revisa la selección.",
  LC_LOTE_FECHA_FUTURA: "La fecha del pago no puede ser futura.",
  LC_LOTE_FECHA_PREVIA_EMISION:
    "La fecha del pago es anterior a la emisión de una de las facturas del lote.",
  LC_LOTE_IMPORTE_NO_CUADRA:
    "El reparto no cuadra con el importe transferido: no se permite sobrante sin asignar.",
  LC_LOTE_IMPORTE_REQUERIDO: "Captura el importe total del lote antes de guardar.",
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
  LC_MOVIMIENTO_SIN_PERMISO:
    "Necesitas permiso de tesorería (tesorero, contador o administrador) para regenerar el movimiento bancario.",
  LC_MOVIMIENTO_SIN_CUENTA:
    "Este pago no salió de una cuenta bancaria registrada, así que no hay movimiento que generar. Edita el pago y elige la cuenta.",
  LC_MOVIMIENTO_YA_EXISTE:
    "Este pago ya tiene su movimiento bancario. Vuelve a conciliar para actualizar la vista.",

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
  // Conceptos de facturas de proveedor (edición manual, v13.629.x).
  LC_CONCEPTOS_FISCALES:
    "Los conceptos vienen del XML del proveedor y no se pueden editar. Vuelve a cargar el XML si necesitas corregirlos.",
  LC_CONCEPTOS_FORBIDDEN:
    "No tienes permisos para editar los conceptos de esta factura.",
  LC_FACTURA_CANCELADA: "La factura está cancelada: ya no se puede modificar.",
  LC_FACTURA_CON_PAGOS:
    "La factura ya tiene pagos registrados. Reversa los pagos antes de editar sus conceptos.",
  LC_FACTURA_ELIMINADA: "La factura fue eliminada.",
  // Auditoría v1 — Ola A (folios, notas de crédito y cancelación CxP).
  LC_CONCEPTOS_YA_ASIGNADOS:
    "Uno o más conceptos ya están en otra proforma o factura. Refresca la pantalla y vuelve a intentar.",
  LC_CXP_CANCELAR_FORBIDDEN:
    "Sólo un rol financiero (admin, contador, auxiliar contable o tesorero) puede cancelar una factura de proveedor.",
  LC_NC_MONEDA_SIN_TC:
    "No hay tipo de cambio para convertir la nota de crédito a la moneda de la factura. Captura el T/C y vuelve a intentar.",
  LC_NC_SIN_TC:
    "Falta el tipo de cambio para validar la nota de crédito contra el saldo de la factura. Captura el T/C y vuelve a intentar.",
  LC_NC_TRANSICION_INVALIDA:
    "Ese cambio de estado de la nota de crédito no está permitido.",
  LC_NC_UUID_REQUERIDO:
    "La nota de crédito necesita su UUID fiscal (CFDI de egreso) antes de timbrarse o aplicarse.",
  LC_CANCEL_CON_CXC:
    "No puedes cancelar el embarque: tiene facturas de cliente con saldo. Cancela o sustituye esas facturas antes de cancelar el embarque.",
  LC_CANCEL_CON_CXP:
    "No puedes cancelar el embarque: tiene facturas de proveedor activas. Cancélalas antes de cancelar el embarque.",
  LC_FACTURA_INMUTABLE:
    "La factura ya está timbrada: sus datos fiscales y conceptos no se pueden modificar. Emite una nota de crédito o una sustitución.",
  LC_NC_FECHA_INVALIDA:
    "La fecha de la nota de crédito no puede ser anterior a la emisión de la factura ni una fecha futura.",
  LC_BAJA_CON_DEPENDENCIAS:
    "No se puede dar de baja: el registro tiene documentos u operaciones asociadas. Cancela o reasigna esas dependencias primero.",
  LC_COTIZACION_EN_OPERACION:
    "La cotización ya está en operación (tiene embarque o proforma): no se puede modificar. Crea una nueva versión.",
  LC_COTIZACION_INMUTABLE:
    "La cotización ya fue aceptada o está en operación: sus importes y conceptos no pueden cambiar. Crea una nueva versión.",
  LC_FACTURA_SIN_CONCEPTOS:
    "La factura no tiene conceptos con importe: agrega al menos un concepto antes de emitirla o timbrarla.",
  LC_CXP_FOLIO_DUPLICADO:
    "Ya existe una factura de proveedor con ese folio interno. Recarga la lista y vuelve a guardar.",
  LC_CXP_SOBRECOSTO:
    "Lo facturado por el proveedor excede el costo comprometido del embarque en más del 5%. Revisa los conceptos vinculados o ajusta el costo antes de aprobar.",
  LC_FACTURA_DELETE_PROHIBIDO:
    "Las facturas no se borran: cancélala o emite una nota de crédito para dejar el rastro fiscal.",
  // ── Ola 4 · respaldo mínimo al aprobar CxP (three-way match) ───────────
  LC_CXP_SIN_RESPALDO:
    "Esta factura no está ligada a un embarque ni a costos acordados. Escribe la justificación del gasto (mínimo 10 caracteres) para poder aprobarla.",
  LC_CXP_SIN_RESPALDO_MONTO:
    "La factura excede el monto que puede aprobarse sin respaldo. Vincúlala al embarque o a sus conceptos de costo antes de aprobar (el límite se ajusta en Configuración → Compras).",
};


