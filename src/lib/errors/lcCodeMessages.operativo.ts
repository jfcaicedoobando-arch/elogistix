/**
 * Índice de mensajes `LC_*` del dominio operativo.
 *
 * Importa y combina los catálogos por subdominio para respetar el
 * límite Power-of-10 de 200 líneas por archivo.
 */
import { LC_CODE_MESSAGES_OPERATIVO_AUTH } from "./lcCodeMessages.operativo.auth";
import { LC_CODE_MESSAGES_OPERATIVO_OPERACIONES } from "./lcCodeMessages.operativo.operaciones";
import { LC_CODE_MESSAGES_OPERATIVO_GARANTIAS } from "./lcCodeMessages.operativo.garantias";
import { LC_CODE_MESSAGES_OPERATIVO_GENERICOS } from "./lcCodeMessages.operativo.genericos";

export const LC_CODE_MESSAGES_OPERATIVO: Record<string, string> = {
  ...LC_CODE_MESSAGES_OPERATIVO_AUTH,
  ...LC_CODE_MESSAGES_OPERATIVO_OPERACIONES,
  ...LC_CODE_MESSAGES_OPERATIVO_GARANTIAS,
  ...LC_CODE_MESSAGES_OPERATIVO_GENERICOS,
};
