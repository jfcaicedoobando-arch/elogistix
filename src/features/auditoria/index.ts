/**
 * Barrel público del dominio Auditoría operativa.
 * Superficie mínima: página + hooks. El resto se importa por path explícito.
 */
export { default as AuditoriaPage } from "./routes/AuditoriaPage";
export * from "./hooks";
export * from "./types";
