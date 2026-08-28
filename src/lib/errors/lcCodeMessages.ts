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
};
