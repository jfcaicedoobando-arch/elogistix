/**
 * Estado de filtros del Buzón de facturas de proveedor (pestaña Pendientes).
 * v13.365.0 — La página no calcula reglas: todo viene del dominio.
 */
import { useMemo, useState } from "react";
import {
  filtrarEntrantes,
  resumirBuzon,
  type ChipBuzon,
  type OrdenBuzon,
} from "@/lib/domain/facturasEntrantesBuzon";
import type { FacturaEntranteRow } from "@/features/cxp/services/facturasEntrantes";

export function useBuzonEntrantesFiltros(pendientes: FacturaEntranteRow[]) {
  const [q, setQ] = useState("");
  const [chip, setChip] = useState<ChipBuzon>("todos");
  const [orden, setOrden] = useState<OrdenBuzon>("antiguos");

  const resumen = useMemo(() => resumirBuzon(pendientes), [pendientes]);
  const filtradas = useMemo(
    () => filtrarEntrantes(pendientes, { q, chip, orden }),
    [pendientes, q, chip, orden],
  );

  return { q, setQ, chip, setChip, orden, setOrden, resumen, filtradas };
}
