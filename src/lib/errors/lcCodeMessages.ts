/**
 * Catálogo de mensajes amigables para códigos `LC_*` emitidos por Supabase.
 * Extraído de `lcCodes.ts` para respetar el límite Power-of-10 de 200 líneas.
 *
 * Añade nuevas entradas conforme aparezcan códigos en las migraciones.
 */
export const LC_CODE_MESSAGES: Record<string, string> = {
  // ── Autenticación / tenancy ────────────────────────────────────────────
  LC_AUTH_REQUIRED: "Debes iniciar sesión para continuar.",
  LC_NO_AUTORIZADO: "No tienes permisos para realizar esta acción.",
  LC_ROL_LEGACY_BLOQUEADO:
    "Ese rol ya no se usa. Asigna uno del catálogo actual (por ejemplo, admin_org o coordinador_logistico).",
  LC_FORBIDDEN_FACTURA_PROVEEDOR_DELETE:
    "No tienes permisos para eliminar facturas de proveedor.",
  LC_ORG_FORBIDDEN: "Este recurso pertenece a otra organización.",
  LC_ORG_NO_RESUELTA: "No fue posible resolver la organización activa. Vuelve a iniciar sesión.",
  LC_TENANT_MISMATCH: "El recurso no pertenece a tu organización.",
  LC_DELETE_PROHIBIDO: "Este registro no puede eliminarse desde la aplicación.",

  // ── Concurrencia / transiciones ────────────────────────────────────────
  LC_CONFLICTO_CONCURRENCIA:
    "Alguien más modificó este registro. Recarga la página para ver los datos actuales.",
  LC_TRANSICION_INVALIDA:
    "El estado del registro cambió en otra sesión. Recarga la página para ver el estado actual.",

  // ── Embarques ──────────────────────────────────────────────────────────
  LC_EMBARQUE_NO_ENCONTRADO: "El embarque no existe o fue eliminado.",
  LC_EMBARQUE_ELIMINADO: "El embarque ya fue eliminado.",
  LC_EMBARQUE_BLOQUEADO: "El embarque está bloqueado y no admite cambios.",
  LC_CIERRE_SOLO_RPC:
    "El cierre del embarque debe hacerse desde el flujo oficial (no editable manualmente).",

  // ── Cotizaciones ───────────────────────────────────────────────────────
  LC_COT_NO_ENCONTRADA: "La cotización no existe o fue eliminada.",
  LC_COT_ELIMINADA: "La cotización ya fue eliminada.",
  LC_COT_ESTADO_INVALIDO: "El estado actual de la cotización no permite esta acción.",
  LC_COT_TRANSICION_INVALIDA:
    "La cotización cambió de estado en otra sesión. Recarga para continuar.",
  LC_COT_NO_RESPONDIBLE: "Esta cotización ya no admite respuesta del cliente.",
  LC_COT_VENCIDA: "La cotización venció y ya no puede responderse.",
  LC_COT_SIN_CLIENTE: "La cotización no tiene cliente asociado.",
  LC_COTIZACION_VENCIDA: "La cotización venció y no puede convertirse en embarque.",
  LC_COTIZACION_ESTADO_INVALIDO:
    "La cotización no está en un estado válido para esta operación.",
  LC_COTIZACION_CON_EMBARQUE: "Esta cotización ya tiene un embarque asociado.",
  LC_TARIFA_REQUIERE_REVALIDACION:
    "La tarifa cambió o venció. Revalida la cotización antes de continuar.",
  LC_RESPUESTA_INVALIDA: "La respuesta del cliente no es válida.",

  // ── Cliente / catálogos ────────────────────────────────────────────────
  LC_CLIENTE_NOMBRE_REQUERIDO: "El nombre del cliente es obligatorio.",

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
  LC_ANTICIPO_PROVEEDOR_MISMATCH:
    "El proveedor del anticipo no coincide con el de la factura.",
  LC_ANTICIPO_PROVEEDOR_NO_EXISTE: "El proveedor del anticipo no existe.",
  LC_ANTICIPO_PROVEEDOR_OTRA_ORG: "El proveedor pertenece a otra organización.",

  // ── Garantías / demoras ────────────────────────────────────────────────
  LC_GARANTIA_NO_ENCONTRADA: "La garantía no existe.",
  LC_GARANTIA_NO_RETENIDA: "La garantía no está en estado retenida.",
  LC_GARANTIA_ORG_MISMATCH: "La garantía pertenece a otra organización.",
  LC_GARANTIA_SIN_ROL: "No tienes permisos para gestionar garantías.",
  LC_GARANTIA_SIN_NAVIERA: "El embarque no tiene naviera asignada.",
  LC_GARANTIA_SIN_PROVEEDOR_NAVIERA:
    "La naviera no tiene un proveedor vinculado en el sistema.",
  LC_GARANTIA_SIN_CATEGORIA_PRESUPUESTO:
    "Falta la categoría de presupuesto para registrar la garantía.",
  LC_GARANTIA_MONTO_REQUERIDO: "Captura el monto de la garantía.",
  LC_GARANTIA_MONTO_CONGELADO:
    "El monto ya está congelado y no puede modificarse.",
  LC_GARANTIA_FECHA_DEPOSITO_REQUERIDA: "Captura la fecha de depósito.",
  LC_GARANTIA_FECHA_LIBERACION_REQUERIDA: "Captura la fecha de liberación.",
  LC_GARANTIA_FACTURA_YA_MATERIALIZADA:
    "La garantía ya fue materializada en una factura y no puede modificarse.",
  LC_GARANTIA_TRANSICION_INVALIDA:
    "La garantía no puede pasar a ese estado desde el actual.",
  LC_DEMORAS_BLOQUEADAS: "Las demoras están bloqueadas para este embarque.",

  // ── Proformas ──────────────────────────────────────────────────────────
  LC_PROFORMA_SIN_PERMISO: "No tienes permisos para modificar esta proforma.",
  LC_PROFORMA_TC_REQUERIDO:
    "Captura el tipo de cambio antes de convertir la proforma.",
  LC_PROFORMA_YA_FACTURADA: "La proforma ya fue facturada.",
  LC_PROFORMA_FACTURADA_NO_ELIMINABLE:
    "No puedes eliminar una proforma que ya fue facturada.",
  LC_PROFORMA_MONEDA_NO_SOPORTADA:
    "La moneda de la proforma aún no está soportada para conversión (usa MXN o USD).",

  // ── App-raised (no vienen de la BD) ────────────────────────────────────
  LC_FACTURA_CON_REP_VIVO:
    "La factura tiene un complemento de pago (REP) vivo. Cancela primero el REP para continuar.",
  LC_MOVIMIENTO_YA_VINCULADO:
    "El movimiento bancario ya está vinculado a otro pago. Desvincúlalo antes de reutilizarlo.",

  // ── Genéricos ──────────────────────────────────────────────────────────
  LC_MONEDA_NO_SOPORTADA: "Moneda no soportada por el sistema.",
  LC_TC_REQUERIDO: "Captura el tipo de cambio del día.",
  LC_TC_NO_DISPONIBLE:
    "El tipo de cambio de la factura no está disponible. Refresca antes de emitir la nota de crédito.",
  LC_TC_DOF_NO_DISPONIBLE:
    "No fue posible obtener el tipo de cambio del DOF. Intenta de nuevo en unos segundos.",
  LC_CXP_NO_EXISTE: "La factura de proveedor no existe o fue eliminada.",
  LC_CXP_TOTAL_NEGATIVO: "El total de la factura de proveedor no puede ser negativo.",
  LC_CXP_TOTAL_MENOR_PAGADO:
    "El total no puede quedar por debajo de lo ya pagado. Cancela o ajusta los pagos primero.",
  LC_COTIZACION_CONCEPTO_INVALIDO:
    "Uno de los conceptos de la cotización tiene datos inválidos. Revísalos antes de guardar.",
  LC_FORBIDDEN: "No tienes permisos para realizar esta acción.",
  LC_ORG_MISMATCH: "El recurso no pertenece a tu organización.",
  // Infraestructura de migración (FIX C5): no deberían llegar a la UI.
  LC_C5_ANCLA_NO_ENCONTRADA:
    "No se pudo aplicar un ajuste interno de base de datos. Reporta este error a soporte.",
  LC_C5_INCOMPLETO:
    "Un ajuste interno de base de datos quedó incompleto. Reporta este error a soporte.",
  LC_C5B_ANCLA_AUSENTE:
    "No se pudo aplicar un ajuste interno de base de datos. Reporta este error a soporte.",
  LC_C5B_INCOMPLETO:
    "Un ajuste interno de base de datos quedó incompleto. Reporta este error a soporte.",
};


