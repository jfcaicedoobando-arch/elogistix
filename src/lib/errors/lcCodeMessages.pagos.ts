/**
 * Mensajes `LC_*` de pagos, REP, conciliación bancaria y anticipos.
 *
 * Separado de `lcCodeMessages.financiero.ts` para respetar el límite de 200
 * líneas (Power of 10). Se consume desde `lcCodeMessages.ts` (índice).
 */
export const LC_CODE_MESSAGES_PAGOS: Record<string, string> = {
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
  LC_PAGO_TC_FACTURA_REQUERIDO:
    "La factura en divisa necesita su tipo de cambio para poder recibir un pago en otra moneda.",
  LC_PAGO_TC_NO_VERIFICABLE:
    "El tipo de cambio capturado no es verificable (se esperan pesos por 1 dólar o euro). Corrígelo antes de registrar el pago para no abonar de más.",
  LC_PAGO_TC_FACTURA_NO_VERIFICABLE:
    "La factura en divisa tiene un tipo de cambio no verificable. Corrígelo en la factura antes de aplicar pagos en otra moneda.",
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
  LC_REP_HISTORIA_INMUTABLE:
    "Este movimiento es anterior a un complemento de pago (REP) timbrado y vigente. Cancela y reemite los REP afectados antes de modificar la historia de cobros.",

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
  // N13 · devolución simple de anticipos (v13.791.0).
  LC_ANTICIPO_YA_DEVUELTO: "Este anticipo ya tiene una devolución registrada.",
  LC_ANTICIPO_MONTO_EXCEDE_SALDO:
    "La devolución no puede ser mayor al saldo disponible del anticipo.",
  LC_ANTICIPO_FECHA_REQUERIDA: "Indica la fecha de la devolución.",
  LC_ANTICIPO_FECHA_INVALIDA:
    "La devolución no puede ser anterior a la fecha del anticipo.",
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
  // Ola E2 · A (N15): proformas y facturas en borrador colgadas del embarque.
  LC_CANCEL_CON_FACTURA_BORRADOR:
    "No puedes cancelar el embarque: tiene facturas de cliente en borrador. Elimínalas antes de cancelar el embarque.",
  LC_CANCEL_CON_PROFORMA:
    "No puedes cancelar el embarque: tiene proformas vivas. Cancélalas o elimínalas antes de cancelar el embarque.",
  // Ola E2 · A (N7): borrado lógico de facturas con documentos hijos vivos.
  LC_FACTURA_DELETE_CON_PAGOS:
    "La factura tiene pagos registrados. Elimina o cancela esos pagos antes de borrarla.",
  LC_FACTURA_DELETE_CON_NC:
    "La factura tiene notas de crédito vivas. Cancélalas antes de borrar la factura.",
  LC_FACTURA_DELETE_EMITIDA:
    "La factura ya fue emitida: cancélala ante el SAT antes de borrarla del sistema.",

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
    "Lo facturado por el proveedor para ese concepto excede el costo comprometido en más del 5% (contando todas las facturas ligadas a ese costo). Revisa los conceptos vinculados o ajusta el costo antes de aprobar.",
  LC_CXP_SIN_TC:
    "No hay tipo de cambio para comparar el costo con la factura, así que no pudo validarse el sobrecosto de ese concepto. Captura el tipo de cambio del embarque o de la factura.",
  LC_FACTURA_DELETE_PROHIBIDO:
    "Las facturas no se borran: cancélala o emite una nota de crédito para dejar el rastro fiscal.",
  // ── Ola 4 · respaldo mínimo al aprobar CxP (three-way match) ───────────
  LC_CXP_SIN_RESPALDO:
    "Esta factura no está ligada a un embarque ni a costos acordados. Escribe la justificación del gasto (mínimo 10 caracteres) para poder aprobarla.",
  LC_CXP_SIN_RESPALDO_MONTO:
    "La factura excede el monto que puede aprobarse sin respaldo. Vincúlala al embarque o a sus conceptos de costo antes de aprobar (el límite se ajusta en Configuración → Compras).",

  // ── Ola 4 · cronología de pagos ────────────────────────────────────────
  LC_PAGO_FECHA_PREVIA:
    "La fecha del pago es anterior a la emisión de la factura, así que el cobro no cuadra con el CFDI. Corrige la fecha del pago.",
  // Ola v13.823.34 — CxP atómico y programación de pagos.
  LC_CXP_CANCELADA: "La factura de proveedor está cancelada: no admite más movimientos.",
  LC_CXP_ORG_MISMATCH:
    "La factura de proveedor pertenece a otra organización. Recarga la página y vuelve a intentarlo.",
  LC_CXP_ROL_NO_AUTORIZADO:
    "Tu rol no tiene permiso para capturar o autorizar cuentas por pagar.",
  LC_CXP_FECHA_PROGRAMADA_INVALIDA:
    "La fecha programada de pago no es válida: no puede ser anterior a la emisión de la factura.",
  LC_PAGO_FECHA_INVALIDA: "La fecha del pago no es válida.",
  LC_PAGO_SIN_PROGRAMACION:
    "El pago no tiene una programación asociada. Progámalo antes de ejecutarlo.",
};
