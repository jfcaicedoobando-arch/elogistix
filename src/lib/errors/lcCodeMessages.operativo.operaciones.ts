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
  LC_CIERRE_SOLO_RPC:
    "El cierre del embarque debe hacerse desde el flujo oficial (no editable manualmente).",
  LC_CIERRE_AUTOMATICO_NO_APLICA:
    "El cierre automático no aplica: el embarque aún tiene pendientes en el checklist de cierre.",

  // ── Cotizaciones ───────────────────────────────────────────────────────
  LC_COT_NO_ENCONTRADA: "La cotización no existe o fue eliminada.",
  LC_COT_ELIMINADA: "La cotización ya fue eliminada.",
  LC_COT_ESTADO_INVALIDO: "El estado actual de la cotización no permite esta acción.",
  LC_COT_TRANSICION_INVALIDA:
    "La cotización cambió de estado en otra sesión. Recarga para continuar.",
  LC_COT_NO_RESPONDIBLE: "Esta cotización ya no admite respuesta del cliente.",
  LC_COT_VENCIDA: "La cotización venció y ya no puede responderse.",
  LC_COT_SIN_OPORTUNIDAD:
    "Vincula la cotización a una oportunidad del CRM antes de enviarla al prospecto.",
  LC_COT_SIN_CLIENTE: "La cotización no tiene cliente asociado.",
  LC_COTIZACION_VENCIDA: "La cotización venció y no puede convertirse en embarque.",
  LC_COTIZACION_ESTADO_INVALIDO:
    "La cotización no está en un estado válido para esta operación.",
  LC_COTIZACION_CON_EMBARQUE: "Esta cotización ya tiene un embarque asociado.",
  LC_COTIZACION_CONCEPTO_INVALIDO:
    "Uno de los conceptos de la cotización tiene datos inválidos. Revísalos antes de guardar.",
  LC_COTIZACION_MONEDA_NO_SOPORTADA:
    "La cotización incluye una moneda que aún no está soportada. Usa MXN o USD.",
  LC_TARIFA_REQUIERE_REVALIDACION:
    "La tarifa cambió o venció. Revalida la cotización antes de continuar.",
  LC_RESPUESTA_INVALIDA: "La respuesta del cliente no es válida.",

  // ── Ola 7 · cronología de eventos de embarque ──────────────────────────
  LC_EVENTO_FECHA_FUTURA:
    "Ese evento ya ocurrido no puede llevar fecha futura. Corrige la fecha del evento.",
  LC_EVENTO_ORDEN_INVALIDO:
    "El orden de los eventos no es posible (por ejemplo, entrega antes del arribo o arribo antes del zarpe). Revisa las fechas.",

  // ── Cliente / catálogos ────────────────────────────────────────────────
  LC_CLIENTE_NOMBRE_REQUERIDO: "El nombre del cliente es obligatorio.",
  LC_EMAIL_DUPLICADO:
    "Ese correo ya está registrado en otro cliente o contacto de tu organización. Usa uno distinto o edita el registro existente.",
};
