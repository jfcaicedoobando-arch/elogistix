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
  LC_ROL_PLATAFORMA_NO_PERMITIDO:
    "El rol de super administrador es de plataforma: no puede asignarse dentro de una organización.",
  LC_FORBIDDEN_FACTURA_PROVEEDOR_DELETE:
    "No tienes permisos para eliminar facturas de proveedor.",
  LC_ORG_FORBIDDEN: "Este recurso pertenece a otra organización.",
  LC_ORG_NO_RESUELTA: "No fue posible resolver la organización activa. Vuelve a iniciar sesión.",
  LC_ORG_AJENA: "No tienes acceso a la información de esa organización.",
  LC_ORG_REQUERIDA:
    "Selecciona una organización en el menú superior para ver este reporte.",
  LC_ORG_SCOPE_PENDIENTE:
    "Selecciona una organización activa antes de continuar.",
  LC_ORG_INEXISTENTE: "La organización seleccionada ya no existe.",
  LC_SIN_ORG:
    "Tu usuario no tiene una organización asignada. Contacta al administrador.",
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
  LC_PROFORMA_TOTAL_CERO:
    "La proforma está en ceros: revisa los conceptos antes de marcarla como facturada.",
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
  LC_C5B_FN_AUSENTE:
    "Un componente interno de base de datos no está disponible. Reporta este error a soporte.",
  LC_COSTEO_RECARGO_SIN_PADRE:
    "El recargo no tiene una tarifa válida asociada. Vuelve a abrir la tarifa e inténtalo de nuevo.",
  LC_COSTEO_DEMORA_SIN_PADRE:
    "El tramo de demoras no tiene condiciones de naviera válidas asociadas. Vuelve a abrir la configuración e inténtalo de nuevo.",
  LC_SEED_DEMO_NO_AUTORIZADO:
    "Solo un administrador global puede reiniciar los datos de la organización demo.",
  LC_NO_AUTENTICADO:
    "Tu sesión expiró. Vuelve a iniciar sesión e inténtalo de nuevo.",
  LC_CLIENTE_NO_VINCULADO:
    "Tu usuario aún no está vinculado a una empresa. Pide a tu ejecutivo que complete la vinculación.",
  LC_RUTA_REQUERIDA:
    "Indica el origen y el destino para poder continuar.",

  // ── Tipo de cambio DOF ────────────────────────────────────────────────
  LC_TC_DOF_FORBIDDEN:
    "Solo un administrador puede capturar o modificar el tipo de cambio DOF.",
  LC_TC_DOF_INVALIDO:
    "El tipo de cambio capturado no es válido. Verifica la fecha y que los valores sean mayores a cero.",
  // ── Buzón de facturas entrantes (CxP Inbox) ───────────────────────────
  LC_NOT_FOUND:
    "No encontramos el registro. Es posible que alguien más lo haya eliminado; recarga la página.",
  LC_ESTADO_INVALIDO:
    "Este registro ya cambió de estado. Recarga la página para ver la información actualizada.",
  LC_MOTIVO_REQUERIDO:
    "Indica el motivo para poder continuar.",
  LC_COTIZACION_SIN_IMPORTES:
    "La cotización no tiene importes de venta capturados. Agrega al menos un concepto con precio antes de continuar.",
  // ── Ola 6: RPC transaccionales (CRM, cotizaciones, tarifas, proformas) ──
  LC_CLIENTE_NO_ENCONTRADO:
    "No encontramos el cliente. Recarga la página y vuelve a intentarlo.",
  LC_CLIENTE_SIN_NOMBRE: "Captura el nombre del cliente para continuar.",
  LC_COTIZACION_NO_ENCONTRADA:
    "No encontramos la cotización. Es posible que alguien más la haya eliminado.",
  LC_COTIZACION_NO_REACTIVABLE:
    "Solo se pueden reactivar cotizaciones rechazadas o vencidas.",
  LC_LEAD_NO_ENCONTRADO:
    "No encontramos el prospecto. Recarga la página y vuelve a intentarlo.",
  LC_OPORTUNIDAD_SIN_NOMBRE: "Captura el nombre de la oportunidad para continuar.",
  LC_PIPELINE_SIN_ETAPAS:
    "El pipeline no tiene etapas configuradas. Configúralas antes de convertir prospectos.",
  LC_PROFORMA_FACTURADA:
    "La proforma ya está facturada: no puede eliminarse ni modificarse.",
  LC_PROFORMA_NO_ENCONTRADA:
    "No encontramos la proforma. Es posible que alguien más la haya eliminado.",
  LC_TARIFA_NO_ENCONTRADA:
    "No encontramos la tarifa. Recarga el catálogo y vuelve a intentarlo.",
  LC_VALIDACION:
    "La validación no pasó. Revisa los motivos indicados y corrige la información antes de continuar.",
};
