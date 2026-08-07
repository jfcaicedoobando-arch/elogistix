/**
 * Helper de bitácora para mutaciones del módulo embarques.
 * Envuelve `registrarActividad` con `modulo: "embarques"` fijo para no
 * duplicar el boilerplate en cada servicio de mutación.
 */
import { registrarActividad } from "@/services/bitacora/registrar";

export interface RegistrarBitacoraEmbarqueInput {
  accion: string;
  entidadId?: string | null;
  entidadNombre?: string | null;
  detalles?: Record<string, unknown>;
}

/** Registra una actividad de embarques en la bitácora (fire-and-forget). */
export function registrarBitacoraEmbarque(
  input: RegistrarBitacoraEmbarqueInput,
): Promise<void> {
  return registrarActividad({
    modulo: "embarques",
    accion: input.accion,
    entidadId: input.entidadId,
    entidadNombre: input.entidadNombre,
    detalles: input.detalles,
  });
}
