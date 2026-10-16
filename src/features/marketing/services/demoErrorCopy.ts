import { DEMO_ACCESS_AVAILABILITY } from "@/features/marketing/lib/demoAccessAvailability";

/** Copy público fijo: no expone mensajes, detalles, credenciales ni pide reintentos. */
export function mensajeAmigableDemo(_err: unknown): string {
  return DEMO_ACCESS_AVAILABILITY.message;
}
