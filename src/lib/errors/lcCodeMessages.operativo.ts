/**
 * Mensajes `LC_*` del dominio operativo: autenticación/tenancy, concurrencia,
 * embarques, cotizaciones, catálogos, garantías/demoras y proformas.
 *
 * Se consume desde `lcCodeMessages.ts` (índice). Separado para respetar el
 * límite Power-of-10 de 200 líneas por archivo.
 */
export const LC_CODE_MESSAGES_OPERATIVO: Record<string, string> = {
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
  LC_COTIZACION_CONCEPTO_INVALIDO:
    "Uno de los conceptos de la cotización tiene datos inválidos. Revísalos antes de guardar.",
  LC_TARIFA_REQUIERE_REVALIDACION:
    "La tarifa cambió o venció. Revalida la cotización antes de continuar.",
  LC_RESPUESTA_INVALIDA: "La respuesta del cliente no es válida.",

  // ── Cliente / catálogos ────────────────────────────────────────────────
  LC_CLIENTE_NOMBRE_REQUERIDO: "El nombre del cliente es obligatorio.",

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

  // ── Genéricos ──────────────────────────────────────────────────────────
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
