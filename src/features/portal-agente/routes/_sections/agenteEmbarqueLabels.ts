/**
 * Identifica borradores sin reservar un folio ni exponer datos comerciales.
 * Reutiliza la misma referencia corta del listado interno.
 */
import { labelExpediente } from "@/lib/domain/labelExpediente";

export function etiquetaExpedienteAgente(
  expediente: string | null | undefined,
  id: string,
): string {
  return labelExpediente(expediente, id);
}
