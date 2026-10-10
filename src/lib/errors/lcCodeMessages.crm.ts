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
  LC_TARIFA_NO_VIGENTE: "La tarifa seleccionada ya no está vigente. Actualiza las opciones del tarifario y elige otra tarifa.",
  LC_CRM_EMPRESA_NO_ENCONTRADA:
    "La empresa no existe o no pertenece a tu organización. Actualiza la lista y selecciona una empresa disponible.",
  LC_CRM_ETAPA_PROSPECTO_FALTANTE:
    "Configura una etapa Prospecto activa en el pipeline antes de convertir esta empresa a prospecto.",
  LC_SCORING_OBJETO_INVALIDO: "El puntaje sólo puede calcularse para empresas u oportunidades del CRM.",
  LC_COT_PRICING_SUBTOTAL_SCHEMA_DRIFT:
    "La definición del cálculo del subtotal de Pricing cambió respecto a la actualización revisada. Avisa a soporte: se requiere revisión técnica antes de aplicar la actualización.",
  LC_COT_PRICING_SUBTOTAL_SECURITY_CHANGED:
    "La configuración de seguridad del cálculo del subtotal de Pricing cambió. Avisa a soporte: se requiere revisión técnica antes de aplicar la actualización.",
  LC_COT_PRICING_TC_REQUERIDO:
    "Captura el tipo de cambio de la cotización en el paso 3 para conservar la moneda de Pricing. Los conceptos mantendrán su moneda original.",
  LC_COT_PRICING_MONEDA_INVALIDA:
    "No se pudo recuperar la moneda de Pricing. Recarga la cotización para revisar el vínculo.",
  LC_COT_PRICING_ORIGEN_CONFIRMADO:
    "El origen de Pricing de esta cotización ya está confirmado y no se puede sustituir. Recarga la cotización para revisar el vínculo.",
  LC_COT_PRICING_ORIGEN_INVALIDO:
    "La empresa, oportunidad, solicitud y tarifa no forman un origen de Pricing válido. Vuelve a seleccionar una respuesta disponible.",
  LC_COT_PRICING_SOLO_RPC:
    "El origen de Pricing se confirma desde el flujo de vinculación de la cotización; no admite cambios directos.",
  LC_PRICING_ACL_DRIFT:
    "La configuración de seguridad del vínculo de Pricing requiere revisión técnica. Avisa a soporte antes de volver a vincular.",
  LC_PRICING_CLIENTE_INCOMPATIBLE:
    "La cotización y la oportunidad corresponden a clientes distintos. Revisa la empresa y la respuesta de Pricing seleccionadas.",
  LC_PRICING_COTIZACION_NO_EDITABLE:
    "Esta cotización ya no admite un vínculo nuevo de Pricing. Revisa su estado y si ya está convertida en embarque.",
  LC_PRICING_INCOTERM_CATALOG_DRIFT:
    "El catálogo de Incoterms cambió respecto a la actualización revisada. Avisa a soporte: se requiere revisión técnica antes de aplicar la actualización.",
  LC_PRICING_INCOTERM_CATALOG_POSTCHECK:
    "No se pudo verificar la actualización del catálogo de Incoterms. Avisa a soporte para una revisión técnica.",
  LC_PRICING_OPORTUNIDAD_NO_ELEGIBLE:
    "La oportunidad de Pricing ya no está disponible en una etapa abierta y activa. Actualiza las respuestas y revisa la oportunidad.",
  LC_PRICING_ORIGEN_INCOMPATIBLE:
    "La tarifa y la solicitud no corresponden a la misma respuesta de Pricing. Vuelve a seleccionar la respuesta completa.",
  LC_PRICING_ORIGEN_INCOMPLETO:
    "Falta identificar la cotización, oportunidad, solicitud o tarifa. Vuelve a seleccionar una respuesta completa de Pricing.",
  LC_PRICING_ORIGEN_NO_AUTORIZADO:
    "El origen de Pricing no está disponible para tu sesión, organización o permisos. Revisa la empresa activa y las respuestas disponibles.",
  LC_PRICING_REQUIERE_CLIENTE:
    "Este vínculo de Pricing requiere una cotización dirigida a un cliente del directorio. Para un prospecto, usa su flujo del CRM.",
  LC_PRICING_SCHEMA_DRIFT:
    "El esquema del vínculo de Pricing requiere revisión técnica. Avisa a soporte antes de continuar.",
  LC_PRICING_SOLICITUD_NO_RESPONDIDA:
    "La solicitud de Pricing todavía no está respondida o cambió de estado. Actualiza las respuestas antes de cotizar.",
  LC_PRICING_CONTENEDOR_REQUERIDO:
    "Captura el tipo y tamaño de contenedor de la solicitud antes de aplicar una tarifa.",
  LC_TARIFA_CONTENEDOR_INCOMPATIBLE:
    "El tipo o tamaño de contenedor de la solicitud no coincide con la tarifa seleccionada. Revisa ambos datos y elige una tarifa compatible.",
  LC_PRICING_ESTADO_INVALIDO: "La solicitud no está en un estado válido para esta acción. Actualiza la bandeja.",
  LC_PRICING_ESTADO_SOLO_RPC: "Cambia el estado desde las acciones de la solicitud de pricing.",
  LC_PRICING_INCOMPLETA: "Completa los datos obligatorios de la solicitud antes de enviarla a pricing.",
  LC_PRICING_INMUTABLE: "Una solicitud enviada no puede cambiar de organización u oportunidad.",
  LC_PRICING_NO_EDITABLE: "La solicitud ya fue enviada o cerrada y no se puede editar como borrador.",
  LC_PRICING_NO_ENCONTRADA: "La solicitud de pricing no existe o ya no está disponible. Actualiza la bandeja.",
  LC_PRICING_OPORTUNIDAD_INVALIDA: "Selecciona una oportunidad vigente de tu organización para solicitar pricing.",
  LC_PRICING_ORG: "La solicitud y sus opciones deben pertenecer a la misma organización.",
  LC_PRICING_SIN_OPCIONES: "Agrega al menos una opción de tarifa antes de marcar la solicitud como respondida.",
  LC_PRICING_SIN_PERMISO: "Tu rol no tiene permiso para realizar esta acción de pricing.",
  LC_PRICING_SOLICITANTE_INVALIDO: "El solicitante debe ser un usuario activo de la organización.",
  LC_REPORTE_INMUTABLE: "El reporte no puede cambiar de organización o tablero. Crea otro reporte si necesitas moverlo.",
  LC_REPORTE_NO_ENCONTRADO: "El reporte ya no está disponible. Actualiza el tablero.",
  LC_REPORTE_TABLERO_INVALIDO: "Selecciona un tablero disponible de tu organización.",
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
  LC_ETAPA_INTERCAMBIO_INVALIDO:
    "Para reordenar el pipeline hay que elegir dos etapas distintas. Vuelve a intentarlo.",
  LC_ETAPA_NO_ENCONTRADA:
    "Esa etapa ya no existe o fue eliminada. Recarga la página para ver el pipeline actual.",
  LC_ETAPA_ORG_DISTINTA:
    "Las etapas seleccionadas pertenecen a organizaciones distintas. Recarga la página e inténtalo de nuevo.",
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
