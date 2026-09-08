/**
 * R201-COT-06: mientras la importación de costos vinculados está en vuelo,
 * el paso 4 queda en sólo lectura. Estas envolturas convierten en no-op las
 * ediciones de costos durante la carga, así ninguna edición se descarta al
 * resolver el fetch ni se declara importado algo incompleto.
 */
import type { useConceptosForm } from "@/features/cotizacion/hooks";

type ConceptosCostoApi = Pick<
  ReturnType<typeof useConceptosForm>,
  "updateConceptoCosto" | "addConceptoCosto" | "removeConceptoCosto"
>;

interface BloqueoCostos {
  costosBloqueados: boolean;
  marcarCostosEditados: () => void;
}

export function buildConceptosCostoBloqueados(
  conceptos: ConceptosCostoApi,
  bloqueo: BloqueoCostos,
) {
  return {
    updateConceptoCosto: (
      id: number,
      field: Parameters<ConceptosCostoApi["updateConceptoCosto"]>[1],
      value: Parameters<ConceptosCostoApi["updateConceptoCosto"]>[2],
    ) => {
      if (bloqueo.costosBloqueados) return;
      bloqueo.marcarCostosEditados();
      conceptos.updateConceptoCosto(id, field, value);
    },
    addConceptoCosto: () => {
      if (bloqueo.costosBloqueados) return;
      bloqueo.marcarCostosEditados();
      conceptos.addConceptoCosto();
    },
    removeConceptoCosto: (id: number) => {
      if (bloqueo.costosBloqueados) return;
      bloqueo.marcarCostosEditados();
      conceptos.removeConceptoCosto(id);
    },
  };
}
