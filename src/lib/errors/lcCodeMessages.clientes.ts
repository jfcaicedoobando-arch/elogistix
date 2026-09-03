/**
 * Mensajes amigables de los códigos `LC_*` del alta y actualización masiva
 * de clientes (RPCs de importación por lotes) y de la conversión canónica
 * Prospecto → Cliente.
 */
export const LC_CODE_MESSAGES_CLIENTES: Record<string, string> = {
  LC_CLIENTE_SIN_ORG:
    "No pudimos identificar tu organización. Vuelve a iniciar sesión e inténtalo de nuevo.",
  LC_CLIENTE_SIN_PERMISO:
    "Tu rol no tiene permiso para dar de alta o editar clientes. Solicítalo a un administrador.",
  LC_CLIENTE_PAYLOAD_INVALIDO:
    "El archivo de clientes no tiene el formato esperado. Revisa las columnas y vuelve a cargarlo.",
  LC_CLIENTE_LOTE_EXCEDIDO:
    "Puedes importar máximo 1,000 clientes por carga. Divide el archivo en partes más pequeñas.",
  LC_CLIENTE_FISCAL_INCOMPLETO:
    "Faltan datos fiscales del cliente (RFC, código postal, régimen fiscal, uso de CFDI, forma y método de pago; con RFC real también la dirección). Complétalos antes de convertir.",

  // ── P0 · conversión canónica Prospecto → Cliente ───────────────────────
  LC_SESION_REQUERIDA:
    "Tu sesión expiró. Vuelve a iniciar sesión e inténtalo de nuevo.",
  LC_COTIZACION_SIN_OPORTUNIDAD:
    "Esta cotización no está ligada a una oportunidad del CRM. Vincúlala primero (el aviso de la pantalla te guía) y vuelve a convertir.",
  LC_OPORTUNIDAD_SIN_PROSPECTO:
    "La oportunidad no tiene un prospecto vivo asociado, así que no puede originar el alta del cliente.",
  LC_COTIZACION_NO_ES_PROSPECTO:
    "Esta cotización no es de un prospecto pendiente de alta: ya pertenece a un cliente del directorio.",
  LC_CONVERSION_INCONSISTENTE:
    "El enlace entre cotización, oportunidad y prospecto quedó incompleto. Avisa a soporte: requiere revisión manual, no se corrige en automático.",
};
