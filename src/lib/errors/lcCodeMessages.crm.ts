/**
 * Mensajes amigables de los códigos `LC_*` del CRM comercial
 * (oportunidades, criterios de salida y autorización de margen).
 */

/**
 * Concepto "oportunidad inexistente" compartido por los dos códigos que lo
 * lanzan: `LC_OPORTUNIDAD_INEXISTENTE` (RPCs históricas) y
 * `LC_OPORTUNIDAD_NO_ENCONTRADA` (`crm_propagar_conversion_cliente`).
 * Se deduplica el texto para que el toast sea idéntico sin importar la RPC.
 */
const MSG_OPORTUNIDAD_INEXISTENTE =
  "La oportunidad ya no existe o pertenece a otra organización.";

export const LC_CODE_MESSAGES_CRM: Record<string, string> = {
  LC_OPORTUNIDAD_INEXISTENTE: MSG_OPORTUNIDAD_INEXISTENTE,
  LC_SIN_PERMISO_AUTORIZAR_MARGEN:
    "Sólo gerencia comercial o administración pueden autorizar el margen de una oportunidad.",
  LC_MOTIVO_PERDIDA_REQUERIDO:
    "Indica el motivo de pérdida para cerrar la oportunidad como perdida.",
  LC_CRM_OPORTUNIDAD_AJENA:
    "La oportunidad pertenece a otra organización, no puedes vincularla aquí.",
  LC_OPORTUNIDAD_SIN_ORIGEN:
    "Toda oportunidad debe nacer de un prospecto calificado o de un cliente del directorio.",
  LC_OPORTUNIDAD_ORIGEN_NO_CALIFICADO:
    "Ese lead todavía no está calificado como prospecto. Complétale el perfil comercial y califícalo antes de crear la oportunidad.",
  LC_CRM_CLIENTE_AJENO:
    "El cliente pertenece a otra organización, no puedes usarlo aquí.",
  LC_CRM_LEAD_AJENO:
    "El prospecto pertenece a otra organización, no puedes usarlo aquí.",
  LC_CRM_ACTIVIDAD_ENTIDAD_AJENA:
    "El registro al que quieres ligar la actividad no existe, fue eliminado o pertenece a otra organización.",

  // ── Ola 1-3 · calificación de leads y cotizaciones de prospecto ────────
  LC_LEAD_ESTADO_NO_CALIFICABLE:
    "El lead no está en un estado que permita calificarlo. Contáctalo y actualiza su estado antes de calificarlo como prospecto.",
  LC_LEAD_PERFIL_INCOMPLETO:
    "Faltan datos del perfil comercial del lead (sector, mercancía, rutas, volumen, frecuencia, dolor/problema y proveedor actual). Complétalos antes de calificarlo.",
  LC_LEAD_SIN_ASIGNAR:
    "Este lead todavía no tiene vendedor asignado. Tómalo o pide que te lo asignen antes de calificarlo.",
  LC_LEAD_ESTADO_DERIVADO:
    "Ese estado lo administra el ERP: se asigna al calificar, cotizar o convertir el lead. A mano sólo puedes usar Nuevo, Contactado o Descalificado.",
  LC_LEAD_SIN_PERMISO_CALIFICAR:
    "No tienes permiso para calificar leads como prospectos. Pídelo a tu gerente comercial.",
  LC_COT_CLIENTE_REQUERIDO:
    "La cotización necesita un cliente. Selecciona el cliente al que va dirigida.",
  LC_COT_PROSPECTO_CON_CLIENTE:
    "Una cotización de prospecto no puede tener cliente asignado. Elige prospecto o cliente, no ambos.",
  LC_COT_PROSPECTO_SIN_EMPRESA:
    "Captura el nombre de la empresa del prospecto antes de guardar la cotización.",
  LC_LEAD_YA_ASIGNADO:
    "Otro vendedor ya tomó este lead. Actualiza la lista para ver la bolsa disponible.",
  LC_LEAD_SIN_PERMISO_TOMA:
    "Tu rol no puede tomar leads de la bolsa. Solicita acceso a ventas o gerencia comercial.",
  LC_LEAD_ALTA_CLIENTE_PROHIBIDA:
    "El alta de clientes se hace únicamente en el módulo de Clientes (con RFC, CP y régimen fiscal). Da de alta al cliente ahí y vuelve a ligarlo en la conversión del lead.",
  LC_CRM_SIN_ETAPA_ABIERTA:
    "Configura al menos una etapa abierta en el pipeline antes de crear oportunidades.",
  LC_CRM_PROSPECTO_SIN_EMPRESA:
    "Captura el nombre de la empresa del prospecto para poder guardarlo.",
  LC_COTIZACION_SIN_PERMISO_ESCRITURA:
    "Tu rol no puede crear ni modificar cotizaciones. Solicita acceso a ventas o gerencia comercial.",
  LC_COTIZACION_SIN_PERMISO:
    "Tu rol no puede archivar ni versionar cotizaciones. Solicita acceso a ventas o gerencia comercial.",
  LC_OPORTUNIDAD_NO_ENCONTRADA: MSG_OPORTUNIDAD_INEXISTENTE,
  LC_PARAMETROS_INVALIDOS:
    "Faltan datos o son inválidos para completar la operación. Revisa el formulario e inténtalo de nuevo.",
  LC_SIN_PERMISO:
    "Tu rol no tiene permiso para esta acción en la organización actual.",
  LC_OPORTUNIDAD_AJENA:
    "La oportunidad está asignada a otra persona. Pide a gerencia comercial que la reasigne.",
  LC_OPORTUNIDAD_YA_CONVERTIDA:
    "Esta oportunidad ya está ligada a otro cliente. Recarga la página para ver el vínculo actual.",

  // FIX3 · P3 — vínculo cotización↔embarque acotado a la organización.
  LC_COTIZACION_OTRA_ORG:
    "La cotización pertenece a otra organización; no puede vincularse a este embarque.",

  // v13.823.57 · autoridad única cotización terminal → oportunidad ganada.
  LC_COTIZACION_GANADORA_EXISTE:
    "Esta oportunidad ya tiene una cotización ganadora. Recarga la pantalla: sólo una cotización puede quedar aceptada o en operación por oportunidad.",
  // v13.823.58 · la cotización ya está aceptada pero su enlace con la
  // oportunidad quedó incompleto: no se repara en automático.
  LC_COTIZACION_ACEPTACION_INCONSISTENTE:
    "La cotización ya está aceptada, pero su enlace con la oportunidad quedó incompleto. Avisa a soporte: requiere revisión manual, no se corrige en automático.",
  LC_COTIZACION_GANADORA_INMUTABLE:
    "La cotización ganadora no puede cambiar de oportunidad ni de organización.",
  LC_OPORTUNIDAD_PERDIDA_REQUIERE_REAPERTURA:
    "La oportunidad está marcada como perdida. Reábrela explícitamente antes de aceptar una cotización.",
  LC_CRM_SIN_ETAPA_GANADA:
    "Configura una etapa ganada activa en el pipeline antes de aceptar cotizaciones.",

  // P0 · vínculo CRM obligatorio de las cotizaciones de prospecto.
  LC_COT_VINCULO_SIN_ORIGEN:
    "Selecciona un prospecto calificado o una oportunidad abierta del CRM: una cotización de prospecto no puede quedar sin origen comercial.",
  LC_COT_VINCULO_CONFIRMADO:
    "Esta cotización ya está ligada a otra oportunidad. Recarga la página: el vínculo confirmado no se puede sustituir desde el cotizador.",
  LC_CRM_LEAD_NO_ELEGIBLE:
    "Ese prospecto no es elegible: sólo se pueden cotizar leads calificados o en etapa de prospecto de tu organización. Califícalo en el CRM.",
  LC_CRM_OPORTUNIDAD_NO_ELEGIBLE:
    "Esa oportunidad no es elegible: debe estar viva, en una etapa abierta, sin cliente asignado y ligada a un prospecto calificado.",
  LC_CRM_MONEDA_INCOMPATIBLE:
    "La cotización y la oportunidad tienen monedas distintas. Corrige la moneda de la cotización o vincúlala a una oportunidad en la misma moneda, o crea una oportunidad nueva.",
  LC_SIN_SESION:
    "Tu sesión expiró. Vuelve a iniciar sesión e inténtalo de nuevo.",
  // Candados multiempresa y de permisos del CRM (P0 conversión canónica).
  LC_CONVERSION_SOLO_RPC:
    "La conversión de prospecto a cliente sólo se puede hacer desde el botón oficial del CRM: no se permiten vínculos directos.",
  LC_COTIZACION_CLIENTE_AJENO_INEXISTENTE:
    "El cliente de la cotización no existe o pertenece a otra organización. Recarga la página y verifica el cliente.",
  LC_COT_VINCULO_ROTO:
    "El vínculo de esta cotización con el CRM quedó incompleto. Avisa a soporte: requiere revisión manual.",
  LC_CRITERIO_AJENO:
    "Ese criterio pertenece a otra organización. Recarga la página y elige uno de tu catálogo.",
  LC_ENTIDAD_AJENA:
    "El registro relacionado pertenece a otra organización. Recarga la página e inténtalo de nuevo.",
  LC_ETAPA_AJENA:
    "Esa etapa pertenece a otro pipeline u organización. Elige una etapa de tu pipeline.",
  LC_LEAD_AJENO:
    "Ese prospecto pertenece a otra organización. Recarga la página y elige un prospecto de tu cartera.",
  LC_MOTIVO_PERDIDA_AJENO:
    "Ese motivo de pérdida pertenece a otra organización. Elige uno de tu catálogo.",
  LC_ROL_SIN_PERMISO_CRM:
    "Tu rol no tiene permiso para esta acción del CRM. Solicítalo a un administrador.",
  LC_MONEDA_INCOMPATIBLE:
    "La cotización y la oportunidad están en monedas distintas. Cotiza en la misma moneda o actualiza la moneda de la oportunidad antes de aceptarla.",
  LC_MIG_NO_APLICADA:
    "Una actualización de la base de datos quedó incompleta. Avisa a soporte para revisarla.",
};
