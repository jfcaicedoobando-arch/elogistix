/**
 * Superficie pública de los servicios de autenticación.
 *
 * Ola 20 · paso 4: sólo re-exporta.
 */
export { resolveLandingRoute } from "@/features/auth/domain/auth";
export * from "./session";
export * from "./loginAudit";
export * from "./credenciales";
