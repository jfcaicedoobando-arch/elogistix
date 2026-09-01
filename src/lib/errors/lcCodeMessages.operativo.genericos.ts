/**
 * Mensajes `LC_*` genéricos, buzón de facturas entrantes, tipo de cambio DOF
 * y RPCs transaccionales.
 *
 * Consumido por `lcCodeMessages.operativo.ts`.
 */
export const LC_CODE_MESSAGES_OPERATIVO_GENERICOS: Record<string, string> = {
  // ── Genéricos ──────────────────────────────────────────────────────────
  LC_FORBIDDEN: "No tienes permisos para realizar esta acción.",
  // N-06 (QA r2): bloqueo optimista al editar registros.
  LC_CONFLICTO_CONCURRENCIA:
    "Otro usuario modificó este registro mientras lo editabas. Recarga la página para ver los datos actuales y vuelve a aplicar tus cambios.",
  LC_ORG_MISMATCH: "El recurso no pertenece a tu organización.",
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
  LC_XML_UUID_INVALIDO:
    "El UUID fiscal del XML no tiene el formato correcto. Verifica el archivo CFDI.",
  LC_XML_TOTAL_INVALIDO:
    "El total detectado del XML debe ser mayor a cero. Verifica el archivo CFDI.",
  LC_XML_SUBTOTAL_INVALIDO:
    "El subtotal (sin IVA) detectado del XML no puede ser negativo. Verifica el archivo CFDI.",
  LC_MOTIVO_REQUERIDO:
    "Indica el motivo para poder continuar.",
  LC_DOC_INEXISTENTE:
    "El documento no existe o no pertenece a tu organización. Recarga la página.",
  LC_DOC_VALIDADO:
    "Este documento ya está validado: cámbialo a pendiente antes de rechazarlo.",
  LC_DOC_YA_RECHAZADO:
    "Este documento ya estaba rechazado. Recarga la página para ver el motivo registrado.",

  LC_ENTRANTE_RETIRO_FORBIDDEN:
    "Solo quien subió el archivo o un administrador puede retirarlo del buzón.",
  LC_ENTRANTE_RETIRO_CAPTURADA:
    "Este documento ya se capturó como factura de proveedor: cancela primero la factura para poder retirarlo.",
  LC_ENTRANTE_REACTIVAR_FORBIDDEN:
    "No tienes permiso para devolver documentos al buzón de por capturar.",
  LC_ENTRANTE_REACTIVAR_ESTADO:
    "Solo un documento rechazado y sin factura vinculada puede volver a 'Por capturar'.",

  LC_COTIZACION_SIN_IMPORTES:
    "La cotización no tiene importes de venta capturados. Agrega al menos un concepto con precio antes de continuar.",

  // ── RPC transaccionales (CRM, cotizaciones, tarifas, proformas) ──
  LC_CLIENTE_NO_ENCONTRADO:
    "No encontramos el cliente. Recarga la página y vuelve a intentarlo.",
  LC_CLIENTE_SIN_NOMBRE: "Captura el nombre del cliente para continuar.",
  LC_COTIZACION_NO_ENCONTRADA:
    "No encontramos la cotización. Es posible que alguien más la haya eliminado.",
  LC_COTIZACION_NO_REACTIVABLE:
    "Solo se pueden reactivar cotizaciones rechazadas o vencidas.",
  LC_ORG_CRUZADA:
    "El registro pertenece a otra organización y no puede vincularse aquí. Recarga la página y verifica la empresa activa.",
  LC_DASHBOARD_SIN_PERMISO:
    "No tienes permiso para ver los indicadores de este tablero.",
  LC_DEMO_SOLO_SERVICIO:
    "Esta acción sólo puede ejecutarla el sistema en la organización de demostración.",
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
  LC_ONBOARDING_ORG_AJENA:
    "No administras esa organización, así que no puedes completar su configuración inicial.",
  LC_ONBOARDING_ORG_REQUERIDA:
    "No pudimos determinar tu organización. Recarga la página e inténtalo de nuevo.",
  LC_OWNER_YA_ASIGNADO:
    "El usuario elegido ya pertenece a una organización. Elige otro o retíralo primero de la actual.",
  LC_VALIDACION:
    "La validación no pasó. Revisa los motivos indicados y corrige la información antes de continuar.",
  LC_ARG_INVALIDO:
    "Los datos enviados no son válidos. Revisa la información y vuelve a intentarlo.",
  LC_CREDITO_TC_INVALIDO:
    "Falta el tipo de cambio de una factura en moneda extranjera, así que no podemos calcular el crédito usado. Captura el tipo de cambio e inténtalo de nuevo.",
  LC_EMB_CLIENTE_INVALIDO:
    "El cliente seleccionado no existe o pertenece a otra organización.",
  LC_EMB_COTIZACION_CLIENTE:
    "La cotización pertenece a otro cliente. Verifica el cliente del embarque.",
  LC_EMB_COTIZACION_INVALIDA:
    "La cotización seleccionada no existe o pertenece a otra organización.",
  LC_EMB_PROVEEDOR_INVALIDO:
    "El proveedor seleccionado no existe o pertenece a otra organización.",
  LC_IDEMPOTENCIA_FN_DISTINTA:
    "Esa clave de operación ya se usó en otro proceso. Recarga la página y vuelve a intentarlo.",
  LC_DELETED_AT_INMUTABLE:
    "No se puede cambiar directamente el estado de borrado del registro. Usa las acciones de eliminar o restaurar de la papelera.",
  LC_RESTORE_DIRECTO:
    "Para restaurar este registro usa la papelera de la app; no puede reactivarse editándolo directamente.",
};
