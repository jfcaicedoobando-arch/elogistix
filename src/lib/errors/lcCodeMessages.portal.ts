/**
 * Mensajes amigables de los códigos `LC_*` del portal de cliente: vínculos
 * de acceso (`client_users`) y avisos/notificaciones enviados al portal.
 */
export const LC_CODE_MESSAGES_PORTAL: Record<string, string> = {
  LC_PORTAL_SIN_PERMISO:
    "Tu rol no tiene permiso para administrar los accesos al portal de este cliente.",
  LC_PORTAL_VINCULO_INEXISTENTE:
    "Ese acceso al portal ya no existe. Actualiza la lista de usuarios del cliente.",
  LC_CLIENT_USERS_INCONSISTENTES:
    "Este acceso al portal quedó ligado a una organización distinta a la del cliente. Revócalo y vuelve a crearlo.",
  LC_NOTIF_CROSS_ORG:
    "No puedes enviar avisos a clientes de otra organización.",
  LC_NOTIF_CLIENTE_INEXISTENTE:
    "El cliente del aviso no existe o fue eliminado.",
  LC_NOTIF_FACTURA_AJENA:
    "La factura del aviso no pertenece a este cliente.",
  LC_NOTIF_EMBARQUE_AJENO:
    "El embarque del aviso no pertenece a este cliente.",
  LC_NOTIF_URL_NO_PERMITIDA:
    "El enlace del aviso debe apuntar a una pantalla del portal del cliente.",
};
