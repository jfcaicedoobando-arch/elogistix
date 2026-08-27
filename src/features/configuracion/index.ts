/**
 * Superficie pública del feature `configuracion` (auditoría 2026-08-18, punto 5).
 *
 * Dueño de responsabilidades: `configuracion` = ajustes del tenant.
 * `admin` (consola de plataforma) reutiliza estas piezas SOLO por este barril;
 * `configuracion` nunca importa de `admin` (ver admin-configuracion-cycle.test.ts).
 */
export { parseConfigSafe, plataformaConfigSchema, seguridadConfigSchema, useConfiguracionByOrg, useConfiguracionState, useConfigGlobalCategoria, useUpdateConfiguracionGlobal } from "./hooks";
export { agruparConfigPorCategoria } from "./domain/configuracion";
export { default as TabEmpresa } from "./components/TabEmpresa";
export { default as TabFacturacion } from "./components/TabFacturacion";
export { default as CierrePeriodoCard } from "./components/CierrePeriodoCard";
export { default as TabPuertos } from "./components/TabPuertos";
export { default as TabOperaciones } from "./components/TabOperaciones";
export { default as TabNavieras } from "./components/TabNavieras";
export { default as TabTiposContenedor } from "./components/TabTiposContenedor";
export { default as TabTipoCambioDof } from "./components/TabTipoCambioDof";
export { OrgInfoCard } from "./components/OrgInfoCard";
