import type { AgenteTarifaRow } from "@/features/portal-agente/services";
import { destinoDe, etiquetaRutaCompleta, origenDe } from "@/features/costeo/utils/puertoLabel";

/**
 * Etapa 6 — etiqueta inequívoca "Nombre, País (CÓDIGO) → …" con rutas globales
 * (hay puertos homónimos en distintos países). Utilidad única de costeo.
 */
export function etiquetaRutaTarifa(t: AgenteTarifaRow): string {
  return etiquetaRutaCompleta(origenDe(t), destinoDe(t));
}
