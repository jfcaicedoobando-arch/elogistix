/**
 * Helper de bitácora para mutaciones del módulo embarques.
 * Envuelve `registrarActividad` con `modulo: "embarques"` fijo para no
 * duplicar el boilerplate en cada servicio de mutación.
 */
import { registrarActividad } from "@/services/bitacora/registrar";
import type { captureAuthOperationScope } from "@/lib/auth/authOperationScope";

export interface RegistrarBitacoraEmbarqueInput {
  accion: string;
  entidadId?: string | null;
  entidadNombre?: string | null;
  detalles?: Record<string, unknown>;
  organizationId?: string;
  authScope?: ReturnType<typeof captureAuthOperationScope>;
}

/** Registra una actividad de embarques en la bitácora (fire-and-forget). */
export function registrarBitacoraEmbarque(
  input: RegistrarBitacoraEmbarqueInput,
): Promise<void> {
  return registrarActividad({
    modulo: "embarques",
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
    ...(input.authScope ? { authScope: input.authScope } : {}),
    accion: input.accion,
    entidadId: input.entidadId,
    entidadNombre: input.entidadNombre,
    detalles: input.detalles,
  });
}
