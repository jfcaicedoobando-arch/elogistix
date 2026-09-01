/**
 * Guardas de `parse-invoice-pdf` (R2 seguridad · P1 — drenaje de cuota IA).
 *
 * Antes la función sólo validaba el JWT: cualquier sesión (incluidos portal
 * cliente, agente de carga y la cuenta demo pública) podía subir PDFs de 10 MB
 * en bucle contra Gemini con la llave del servidor.
 *
 * Ola P2: la lógica (membresía + `ROLES_CAPTURA_CXP` + `check_ratelimit`
 * fail-CLOSED) vive ahora en `_shared/cxpGuard.ts`, compartida con
 * `parse-cfdi-xml` y `adjuntar-xml-entrante`. Este archivo sólo fija los topes.
 */
import { autorizarCxp } from "../_shared/cxpGuard.ts";
import type { AuthContext } from "../_shared/auth.ts";
import type { createLogger } from "../_shared/logger.ts";

type Log = ReturnType<typeof createLogger>;
type Cors = Record<string, string>;

export const RL_USUARIO = { windowSeconds: 3600, max: 20 } as const;
export const RL_ORG = { windowSeconds: 3600, max: 100 } as const;

/**
 * Exige membresía de org + rol de captura CxP y aplica los topes de uso.
 * Devuelve `null` si puede continuar, o la Response de rechazo (403/429/503).
 */
export async function autorizarYLimitar(
  auth: AuthContext,
  cors: Cors,
  log: Log,
): Promise<Response | null> {
  const r = await autorizarCxp(auth, cors, log, {
    fn: "parse-invoice-pdf",
    rlUsuario: RL_USUARIO,
    rlOrg: RL_ORG,
    mensaje429: "Demasiadas solicitudes de parseo con IA. Intenta más tarde.",
  });
  return r.ok ? null : r.res;
}
