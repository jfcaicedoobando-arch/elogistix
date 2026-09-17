/**
 * Bitácora no bloqueante para el CRM.
 *
 * Patrón ya usado en el alta de oportunidad (v13.823.32): la escritura
 * principal (UPDATE/RPC) YA ocurrió, así que un fallo del registro de bitácora
 * no debe presentarse como fracaso de la operación ni cancelar los pasos
 * posteriores (automatizaciones, invalidación de caché). Devuelve un aviso
 * accionable para que la UI lo muestre junto al éxito.
 *
 * Nunca lanza. Los errores REALES de la escritura principal siguen su curso
 * normal (se propagan) — este helper sólo envuelve el efecto secundario.
 */
import { registrarActividad, type RegistrarActividadInput } from "@/services/bitacora/registrar";

export async function registrarActividadNoBloqueante(
  input: RegistrarActividadInput,
): Promise<string | null> {
  try {
    await registrarActividad(input);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Error desconocido";
  }
}

/** Texto único para los toasts de éxito con bitácora fallida. */
export function avisoBitacoraFallida(aviso: string): string {
  return `El cambio SÍ se guardó, pero no quedó registrado en la bitácora: ${aviso}`;
}
