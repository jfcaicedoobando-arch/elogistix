/**
 * Mensajes amigables de los códigos `LC_*` del CRM comercial
 * (oportunidades, criterios de salida y autorización de margen).
 */
export const LC_CODE_MESSAGES_CRM: Record<string, string> = {
  LC_OPORTUNIDAD_INEXISTENTE:
    "La oportunidad ya no existe o pertenece a otra organización.",
  LC_SIN_PERMISO_AUTORIZAR_MARGEN:
    "Sólo gerencia comercial o administración pueden autorizar el margen de una oportunidad.",
};
