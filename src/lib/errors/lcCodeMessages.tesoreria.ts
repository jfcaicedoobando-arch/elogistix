/**
 * Mensajes `LC_*` de tesorería: cuentas bancarias, divisas, anticipos, pagos en
 * lote, estado de cuenta y libro de pagos.
 *
 * Se separó de `lcCodeMessages.financiero.ts` (Power of 10: ≤ 200 líneas).
 * Se consume desde `lcCodeMessages.ts` (índice).
 */
export const LC_CODE_MESSAGES_TESORERIA: Record<string, string> = {
  // ── App-raised (no vienen de la BD) ────────────────────────────────────
  LC_FACTURA_CON_REP_VIVO:
    "La factura tiene un complemento de pago (REP) vivo. Cancela primero el REP para continuar.",
  LC_MOVIMIENTO_YA_VINCULADO:
    "El movimiento bancario ya está vinculado a otro pago. Desvincúlalo antes de reutilizarlo.",
  // Ola E2 · A (N11): el importe del movimiento debe coincidir con el del pago.
  LC_MOVIMIENTO_MONTO_MISMATCH:
    "El importe del movimiento bancario no coincide con el del pago. Registra un pago por el importe real del movimiento o corrige el movimiento antes de conciliar.",


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
  LC_LOTE_TC_REQUERIDO:
    "Falta el tipo de cambio para el pago en lote. Inténtalo de nuevo en unos minutos o captúralo manualmente.",
  LC_LOTE_FACTURA_MONEDA:
    "Una factura del lote está en otra moneda. Captura el tipo de cambio o retírala del lote.",
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
  // ── BL02–BL15 · Idempotencia y candados de pagos ───────────────────────
  LC_LOTE_EN_PROCESO:
    "Este pago en lote ya está en proceso. Espera unos segundos y verifica el historial antes de reintentar.",
  LC_LOTE_FACTURA_NO_VIVA:
    "Una de las facturas del lote está cancelada o eliminada y no admite pagos. Retírala del reparto.",
  LC_ANTICIPO_EN_PROCESO:
    "Esta aplicación de anticipo ya está en proceso. Espera unos segundos y verifica antes de reintentar.",
  // Ronda v3 · F2 — la devolución de anticipo debe ser por el saldo completo.
  LC_ANTICIPO_DEVOLUCION_TOTAL:
    "La devolución debe ser por el saldo completo del anticipo; no se permiten devoluciones parciales.",
  LC_ANTICIPO_FACTURA_NO_VIVA:
    "La factura está cancelada o eliminada y no admite aplicación de anticipos.",
  LC_PAGO_PROGRAMADO_EN_PROCESO:
    "Este pago programado ya está en proceso. Espera unos segundos y verifica antes de reintentar.",
  LC_PAGO_PROV_FACTURA_NO_VIVA:
    "La factura de proveedor está cancelada o eliminada y no admite pagos.",
  LC_LIQUIDACION_EN_PROCESO:
    "Esta liquidación ya está en proceso. Espera unos segundos y verifica antes de reintentar.",
  // ── Ola 2 · O2.5–O2.6 · Anticipos idempotentes y ciclo de liquidaciones ──
  LC_LIQUIDACION_NO_EXISTE: "La liquidación de comisiones no existe o fue eliminada.",
  LC_LIQUIDACION_OTRA_ORG: "La liquidación pertenece a otra organización.",
  LC_LIQUIDACION_SIN_ROL:
    "Sólo administración, contabilidad o tesorería pueden pagar o cancelar liquidaciones de comisión.",
  LC_LIQUIDACION_YA_PAGADA:
    "Esta liquidación ya tiene un pago registrado; revisa el listado antes de volver a pagarla.",
  LC_LIQUIDACION_CANCELADA:
    "La liquidación está cancelada. Genera una liquidación nueva para pagar esas comisiones.",
  LC_LIQUIDACION_PAGADA_NO_CANCELABLE:
    "La liquidación ya fue pagada; registra el ajuste en la siguiente liquidación en lugar de cancelarla.",
  LC_LIQUIDACION_FECHA_FUTURA: "La fecha del pago de la liquidación no puede ser futura.",
  LC_LIQUIDACION_MOTIVO_REQUERIDO: "Captura el motivo de la cancelación de la liquidación.",
  // FIX3 · M-4 — guard de fecha del cobro/pago contra la emisión del CFDI.
  LC_PAGO_FECHA_PREVIA_EMISION:
    "La fecha del pago no puede ser anterior a la fecha de emisión de la factura.",
  // B-4 (v14-2) — PUE de una sola exhibición.
  LC_PAGO_PUE_EXHIBICION_UNICA:
    "Esta factura es PUE (una sola exhibición) y ya tiene un pago registrado. Cancela el pago previo si fue un error.",
  LC_PAGO_PUE_DEBE_LIQUIDAR_TOTAL:
    "Esta factura es PUE: registra el cobro por el total en una sola exhibición. Si el cliente abona, cambia la factura a PPD.",
  // ── Ola E4 · candados de inmutabilidad bancaria y de comisiones ──
  LC_MOVIMIENTO_INMUTABLE:
    "El importe, la fecha y la cuenta de un movimiento bancario no se pueden editar. Cancela el movimiento y captúralo de nuevo.",
  LC_MOVIMIENTO_TRANSICION_INVALIDA:
    "Ese cambio de estado de conciliación no está permitido. Regresa el movimiento a Pendiente primero.",
  LC_LIQUIDACION_TRANSICION_INVALIDA:
    "Ese cambio de estado de la liquidación no está permitido.",
  LC_LIQUIDACION_CANCELADA_INMUTABLE:
    "Una liquidación cancelada ya no se puede modificar. Genera una liquidación nueva.",
  LC_COMISION_DELETE_PROHIBIDO:
    "Las comisiones y liquidaciones no se borran: usa la cancelación oficial para dejar rastro.",
  LC_SIN_TC_DOF:
    "No hay tipo de cambio DOF publicado para esa fecha y moneda. Captura o actualiza el tipo de cambio antes de continuar.",
};
