/**
 * Mensajes amigables de los códigos `LC_*` del CRM comercial
 * (oportunidades, criterios de salida y autorización de margen).
 */
export const LC_CODE_MESSAGES_CRM: Record<string, string> = {
  LC_OPORTUNIDAD_INEXISTENTE:
    "La oportunidad ya no existe o pertenece a otra organización.",
  LC_SIN_PERMISO_AUTORIZAR_MARGEN:
    "Sólo gerencia comercial o administración pueden autorizar el margen de una oportunidad.",
  LC_MOTIVO_PERDIDA_REQUERIDO:
    "Indica el motivo de pérdida para cerrar la oportunidad como perdida.",
  LC_CRM_OPORTUNIDAD_AJENA:
    "La oportunidad pertenece a otra organización, no puedes vincularla aquí.",
  LC_CRM_LEAD_AJENO:
    "El prospecto pertenece a otra organización, no puedes usarlo aquí.",
  LC_LEAD_YA_ASIGNADO:
    "Otro vendedor ya tomó este lead. Actualiza la lista para ver la bolsa disponible.",
  LC_LEAD_SIN_PERMISO_TOMA:
    "Tu rol no puede tomar leads de la bolsa. Solicita acceso a ventas o gerencia comercial.",
  LC_CRM_SIN_ETAPA_ABIERTA:
    "Configura al menos una etapa abierta en el pipeline antes de crear oportunidades.",
  LC_CRM_PROSPECTO_SIN_EMPRESA:
    "Captura el nombre de la empresa del prospecto para poder guardarlo.",
  LC_COTIZACION_SIN_PERMISO_ESCRITURA:
    "Tu rol no puede crear ni modificar cotizaciones. Solicita acceso a ventas o gerencia comercial.",
  LC_COTIZACION_SIN_PERMISO:
    "Tu rol no puede archivar ni versionar cotizaciones. Solicita acceso a ventas o gerencia comercial.",
  LC_OPORTUNIDAD_NO_ENCONTRADA:
    "La oportunidad no existe o pertenece a otra organización.",
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
};
