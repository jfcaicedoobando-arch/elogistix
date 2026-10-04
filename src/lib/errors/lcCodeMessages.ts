/**
 * Catálogo de mensajes amigables para códigos `LC_*` emitidos por Supabase.
 * Índice que compone los catálogos por dominio (Power-of-10: ≤200 líneas).
 *
 * Añade nuevas entradas en `lcCodeMessages.operativo.ts`,
 * `lcCodeMessages.financiero.ts`, `lcCodeMessages.tesoreria.ts`, `lcCodeMessages.cobranza.ts` o
 * `lcCodeMessages.traspasos.ts` según corresponda.
 */
import { LC_CODE_MESSAGES_OPERATIVO } from "./lcCodeMessages.operativo";
import { LC_CODE_MESSAGES_FINANCIERO } from "./lcCodeMessages.financiero";
import { LC_CODE_MESSAGES_PAGOS } from "./lcCodeMessages.pagos";
import { LC_CODE_MESSAGES_TESORERIA } from "./lcCodeMessages.tesoreria";
import { LC_CODE_MESSAGES_COBRANZA } from "./lcCodeMessages.cobranza";
import { LC_CODE_MESSAGES_TRASPASOS } from "./lcCodeMessages.traspasos";
import { LC_CODE_MESSAGES_REFACTURACION } from "./lcCodeMessages.refacturacion";
import { LC_CODE_MESSAGES_CRM } from "./lcCodeMessages.crm";
import { LC_CODE_MESSAGES_PORTAL } from "./lcCodeMessages.portal";
import { LC_CODE_MESSAGES_CLIENTES } from "./lcCodeMessages.clientes";

export const LC_CODE_MESSAGES: Record<string, string> = {
  ...LC_CODE_MESSAGES_OPERATIVO,
  ...LC_CODE_MESSAGES_FINANCIERO,
  ...LC_CODE_MESSAGES_PAGOS,
  ...LC_CODE_MESSAGES_TESORERIA,
  ...LC_CODE_MESSAGES_COBRANZA,
  ...LC_CODE_MESSAGES_TRASPASOS,
  ...LC_CODE_MESSAGES_REFACTURACION,
  ...LC_CODE_MESSAGES_CRM,
  ...LC_CODE_MESSAGES_CLIENTES,
  ...LC_CODE_MESSAGES_PORTAL,
  LC_ANTICIPO_APLICACION_INCONSISTENTE:
    "No se pudo confirmar la aplicación del anticipo. Revisa el vínculo entre factura, pago y anticipo antes de continuar.",
  LC_ANTICIPO_MOVIMIENTO_INCONSISTENTE:
    "El origen de tesorería del anticipo no es consistente. Revisa el cargo original o su registro en efectivo; no generes otro cargo.",
  LC_ANTICIPO_SIN_NUEVO_CARGO:
    "Esta aplicación de anticipo usa la salida original y no admite otro cargo bancario. Revisa el movimiento del anticipo.",
  LC_NC_PROV_TC_INVALIDO:
    "El tipo de cambio debe ser un número válido mayor a cero. Captura una paridad válida o deja el campo vacío para consultar DOF.",
  LC_PAGO_ANTICIPO_NO_EDITABLE:
    "Este pago aplica un anticipo y no se puede editar directamente. Usa «Revertir aplicación de anticipo» y vuelve a aplicarlo; el cargo original se conserva.",
  LC_BITACORA_ACCION_RESERVADA:
    "Las aprobaciones y rechazos se registran automáticamente al realizar esa acción en la factura.",
};
