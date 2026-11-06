/** Mensajes de validación y vínculo de solicitudes de Pricing. */
export const LC_CODE_MESSAGES_PRICING: Record<string, string> = {
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
};
