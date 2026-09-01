/**
 * Superficie pública de los servicios de configuración.
 *
 * Ola 20 · paso 4: sólo re-exporta; la lógica vive en `configuracionClaves.ts`
 * y `emisor.ts`, los tipos en `configuracionTypes.ts`.
 */
export type { ConfigItem, ConfigGlobalItem } from "./configuracionTypes";
export {
  fetchConfiguracion,
  fetchConfiguracionByOrg,
  fetchConfiguracionGlobal,
  updateConfiguracionByCategoriaClave,
  updateConfiguracionGlobalItems,
} from "./configuracionClaves";
export * from "./emisor";
