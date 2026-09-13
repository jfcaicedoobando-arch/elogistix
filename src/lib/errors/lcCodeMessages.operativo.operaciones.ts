/**
 * Mensajes `LC_*` de embarques, cotizaciones y concurrencia de operaciones.
 *
 * Consumido por `lcCodeMessages.operativo.ts`.
 */
export const LC_CODE_MESSAGES_OPERATIVO_OPERACIONES: Record<string, string> = {
  // ── Concurrencia / transiciones ────────────────────────────────────────
  LC_CONFLICTO_CONCURRENCIA:
    "Alguien más modificó este registro. Recarga la página para ver los datos actuales.",
  LC_TRANSICION_INVALIDA:
    "El estado del registro cambió en otra sesión. Recarga la página para ver el estado actual.",
  LC_ESTADO_CONCURRENTE:
    "El embarque cambió de estado en otra pestaña o por otro usuario. Recarga para ver el estado actual.",

  // ── Embarques ──────────────────────────────────────────────────────────
  LC_EMBARQUE_NO_ENCONTRADO: "El embarque no existe o fue eliminado.",
  LC_EMBARQUE_ELIMINADO: "El embarque ya fue eliminado.",
  LC_EMBARQUE_BLOQUEADO: "El embarque está bloqueado y no admite cambios.",
  // v13.823.321 — mínimos operativos para confirmar (shipper, consignatario,
  // ETD/ETA, peso y datos del modo). La lista real llega en el detalle del error.
  LC_CONFIRMADO_INCOMPLETO:
    "Aún falta información para confirmar el embarque. Captura los datos pendientes y vuelve a intentar.",

  // v13.823.312 — candados de cierre (A-1/A-2): el embarque cerrado congela
  // importes, garantías y vínculos financieros hasta que se reabre.
  LC_EMBARQUE_CERRADO:
    "El embarque está cerrado: sus importes y vínculos financieros quedaron congelados. Reábrelo para poder hacer correcciones.",
  LC_CIERRE_SOLO_RPC:
    "El cierre del embarque debe hacerse desde el flujo oficial (no editable manualmente).",
  LC_CIERRE_AUTOMATICO_NO_APLICA:
    "El cierre automático no aplica: el embarque aún tiene pendientes en el checklist de cierre.",

  // ── Cotizaciones ───────────────────────────────────────────────────────
  LC_COT_NO_ENCONTRADA: "La cotización no existe o fue eliminada.",
  LC_COT_ELIMINADA: "La cotización ya fue eliminada.",
  // R221: dos expedientes vivos comparten folio (p. ej. ELIMP00006); el enlace
  // por folio no puede decidir cuál abrir, así que se manda al listado.
  LC_EXPEDIENTE_AMBIGUO:
    "Hay más de un expediente con ese folio. Ábrelo desde el listado de embarques.",
  LC_COT_ESTADO_INVALIDO: "El estado actual de la cotización no permite esta acción.",
  LC_COT_TRANSICION_INVALIDA:
    "La cotización cambió de estado en otra sesión. Recarga para continuar.",
  LC_COT_NO_RESPONDIBLE: "Esta cotización ya no admite respuesta del cliente.",
  LC_COT_VENCIDA: "La cotización venció y ya no puede responderse.",
  LC_COT_SIN_OPORTUNIDAD:
    "Vincula la cotización a una oportunidad del CRM antes de enviarla al prospecto.",
  LC_COT_SIN_CLIENTE:
    "La cotización no tiene cliente asociado. Convierte el prospecto en cliente " +
    "antes de aceptarla o de crear el embarque.",
  LC_COT_TC_REQUERIDO:
    "La cotización tiene importes en más de una moneda y le falta el tipo de cambio. " +
    "Captúralo en la cotización antes de crear el embarque.",
  LC_COT_CONTENEDORES_REQUERIDOS:
    "La cotización es marítima FCL y no indica cuántos contenedores. " +
    "Captura el número de contenedores (1 o más) antes de crear el embarque.",
  LC_COT_IMPORTE_REQUERIDO:
    "La cotización no tiene importe. Captura al menos un concepto con cantidad y " +
    "precio mayores a cero antes de aceptarla.",
  // v13.823.355 (YAGNI r2 · P1)
  LC_COTIZACION_ELIMINADA: "La cotización está eliminada y ya no admite cambios.",
  // v13.823.356 (cobertura LC_* · re-aprobación de tarifa)
  LC_RECOTIZADA_NO_DIRECTA:
    "La re-cotización no se registra aquí: usa el botón Re-cotizar para generar una versión nueva.",
  LC_REVALIDACION_DESACTUALIZADA:
    "La tarifa cambió después de solicitar la re-aprobación. Revalida la cotización y pide una nueva re-aprobación.",
  LC_AGENTE_ORG_INVALIDA:
    "El agente de la cotización no pertenece a esta empresa. Revisa la tarifa antes de crear el embarque.",
  LC_COT_ESTADO_NO_ENVIABLE:
    "La cotización ya no está vigente y no puede enviarse. Re-cotízala o duplícala para enviar una versión nueva.",
  LC_COTIZACION_VENCIDA: "La cotización venció y no puede convertirse en embarque.",

  LC_COTIZACION_ESTADO_INVALIDO:
    "La cotización no está en un estado válido para esta operación.",
  LC_COTIZACION_CON_EMBARQUE: "Esta cotización ya tiene un embarque asociado.",
  LC_RECOTIZAR_ESTADO_INVALIDO:
    "Sólo una cotización aceptada puede re-cotizarse. Si aún está en captura, edítala directamente.",
  LC_COTIZACION_CONCEPTO_INVALIDO:
    "Uno de los conceptos de la cotización tiene datos inválidos. Revísalos antes de guardar.",
  LC_COTIZACION_MONEDA_NO_SOPORTADA:
    "La cotización incluye una moneda que aún no está soportada. Usa MXN o USD.",
  LC_TARIFA_REQUIERE_REVALIDACION:
    "La tarifa cambió o venció. Revalida la cotización antes de continuar.",
  LC_TARIFA_APLICADA_INVALIDA:
    "La tarifa seleccionada no es válida para esta operación. Vuelve a seleccionar una tarifa compatible de tu organización.",
  LC_REAPROBACION_NO_VIGENTE:
    "La aprobación de ventas ya no corresponde a la tarifa actual. Vuelve a revisar los cambios y solicita una nueva aprobación.",
  LC_COT_ESTADO_NO_OPERATIVO:
    "Sólo una cotización aceptada o en operación puede pedir re-aprobación de tarifa.",
  LC_REVALIDACION_SIN_BLOQUEO:
    "La tarifa vigente no cambió lo suficiente para pedir re-aprobación. Puedes continuar con la conversión.",
  LC_RESPUESTA_INVALIDA: "La respuesta del cliente no es válida.",


  // ── Ola 7 · cronología de eventos de embarque ──────────────────────────
  LC_EVENTO_FECHA_FUTURA:
    "Ese evento ya ocurrido no puede llevar fecha futura. Corrige la fecha del evento.",
  LC_EVENTO_ORDEN_INVALIDO:
    "El orden de los eventos no es posible (por ejemplo, entrega antes del arribo o arribo antes del zarpe). Revisa las fechas.",
  // Ola E2 · B (M5-res)
  LC_EVENTO_ANTERIOR_A_EMBARQUE:
    "La fecha del evento es anterior a la creación del embarque. Corrige la fecha o captura el embarque con su fecha real.",
  LC_TRACKING_VIGENCIA_EXCEDIDA:
    "Un enlace público de rastreo puede durar máximo 90 días. Elige una vigencia menor.",



  // ── Cliente / catálogos ────────────────────────────────────────────────
  LC_CLIENTE_NOMBRE_REQUERIDO: "El nombre del cliente es obligatorio.",
  LC_EMAIL_DUPLICADO:
    "Ese correo ya está registrado en otro cliente o contacto de tu organización. Usa uno distinto o edita el registro existente.",

  // ── Ola 4 · medidas del embarque ───────────────────────────────────────
  LC_EMBARQUE_PESO_INVALIDO:
    "El peso no puede ser negativo. Captura el peso real de la carga en kilogramos.",
  LC_EMBARQUE_VOLUMEN_INVALIDO:
    "El volumen no puede ser negativo. Captura el volumen real de la carga en metros cúbicos.",
  LC_EMBARQUE_PIEZAS_INVALIDO:
    "Las piezas no pueden ser negativas. Captura cuántos bultos o piezas trae la carga.",
  LC_COT_YA_TIENE_EMBARQUE:
    "Esta cotización ya se convirtió en embarque. Abre el embarque existente en lugar de crear otro.",

  // ── v13.823.357 · Candados de venta al convertir cotización → embarque ──
  LC_COT_SIN_VENTA:
    "La cotización no tiene ningún concepto de venta con cantidad y precio mayores a cero. Captura el precio de venta antes de crear el embarque.",
  LC_COT_VENTA_NO_REFLEJADA:
    "Hay precio de venta capturado en los costos que no llegó a los conceptos de venta. Abre la cotización, vuelve a guardar el paso 3 y reintenta.",
  LC_COT_VENTA_IMPORTE_INVALIDO:
    "Un concepto de venta tiene cantidad o precio en cero (o negativo). Corrígelo en la cotización antes de convertirla.",
  LC_COT_MONEDA_NO_SOPORTADA:
    "Hay importes en una moneda no soportada. Sólo se manejan pesos (MXN) y dólares (USD).",
  // v13.823.358 · Addendum P1: los costos internos sólo se editan en captura.
  LC_COT_COSTOS_ESTADO_INVALIDO:
    "Esta cotización ya no está en captura, así que sus costos no pueden reemplazarse. Usa \"Re-cotizar\" para generar una nueva versión.",
  LC_COT_COSTOS_CON_EMBARQUE:
    "Esta cotización ya tiene un embarque vinculado; sus costos no pueden reemplazarse. Ajusta los costos en el embarque.",
};
