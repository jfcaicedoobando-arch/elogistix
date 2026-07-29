/**
 * Catálogo de mensajes amigables para códigos `LC_*` emitidos por Supabase.
 * Índice que compone los catálogos por dominio (Power-of-10: ≤200 líneas).
 *
 * Añade nuevas entradas en `lcCodeMessages.operativo.ts` o
 * `lcCodeMessages.financiero.ts` según corresponda.
 */
import { LC_CODE_MESSAGES_OPERATIVO } from "./lcCodeMessages.operativo";
import { LC_CODE_MESSAGES_FINANCIERO } from "./lcCodeMessages.financiero";

export const LC_CODE_MESSAGES: Record<string, string> = {
  ...LC_CODE_MESSAGES_OPERATIVO,
  ...LC_CODE_MESSAGES_FINANCIERO,
};
