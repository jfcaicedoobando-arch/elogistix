import type { FilaNaviera } from "@/features/costeo/types/filaNaviera";
import type { AgenteTarifaRow } from "@/features/portal-agente/services/tarifas";
import { filtroDeTarifaAgente } from "./agenteTarifasFiltros";

type TarifaNaviera = Pick<AgenteTarifaRow,
  "naviera_id" | "estado" | "estado_aprobacion" | "vigente_desde" | "vigente_hasta">;

/** Prioriza sin ocultar catálogo ni mutar el orden recibido. */
export function priorizarNavierasAgente(filas: FilaNaviera[], tarifas: TarifaNaviera[], hoy: string) {
  const ids = new Set(tarifas.filter((t) => {
    const estado = filtroDeTarifaAgente(t, hoy);
    return estado === "vigente" || estado === "programada";
  }).map((t) => t.naviera_id));
  const propias = filas.filter((f) => ids.has(f.naviera_id));
  const restantes = filas.filter((f) => !ids.has(f.naviera_id));
  return { filas: [...propias, ...restantes], ids: new Set(propias.map((f) => f.naviera_id)) };
}
