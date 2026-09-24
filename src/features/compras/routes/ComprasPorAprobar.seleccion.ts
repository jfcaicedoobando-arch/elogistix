import { useMemo } from "react";
import { esValidableEnSat } from "@/features/cxp";
import type { FacturaCxP } from "@/features/cxp/services";
import { sumaMxn, sumaUsd } from "./ComprasPorAprobar.helpers";

export function useSeleccionEfectiva(
  rows: FacturaCxP[],
  selected: Set<string>,
  bloqueadosSod: Set<string>,
) {
  return useMemo(() => {
    const filas = rows.filter((row) =>
      selected.has(row.id) &&
      row.estado_aprobacion === "pendiente" &&
      !bloqueadosSod.has(row.id));
    return {
      filas,
      ids: filas.map((row) => row.id),
      totalMxn: sumaMxn(filas),
      totalUsd: sumaUsd(filas),
      validablesSat: filas.filter(esValidableEnSat).map((row) => row.id),
      idsSinEmbarque: new Set(filas.filter((row) => !row.embarque_id).map((row) => row.id)),
    };
  }, [rows, selected, bloqueadosSod]);
}