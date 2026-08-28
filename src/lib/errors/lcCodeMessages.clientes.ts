/**
 * Mensajes amigables de los códigos `LC_*` del alta y actualización masiva
 * de clientes (RPCs de importación por lotes).
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
    "Si el cliente lleva RFC, también necesita régimen fiscal, uso de CFDI, código postal y dirección.",
};
