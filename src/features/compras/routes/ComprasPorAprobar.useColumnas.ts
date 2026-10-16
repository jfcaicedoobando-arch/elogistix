/**
 * Columnas de la bandeja /compras/por-aprobar, con la columna de selección en
 * lote cuando aplica. Extraído de `ComprasPorAprobar.tsx` (límite 200 líneas).
 *
 * SoD: administradores y contadores pueden seleccionar sus propias facturas
 * de proveedor para aprobación, conforme a `aprobar_factura_proveedor`.
 * La selección exige permiso de aprobación y no otorga permisos de pago.
 */
import { useMemo } from "react";
import { buildCxPColumns } from "@/features/cxp";
import { useSodAprobacion } from "@/features/cxp/hooks";
import { SOD_MOTIVO_CAPTURA_PROPIA } from "@/features/cxp/permissions";
import { buildSelectionColumn } from "./ComprasPorAprobar.selectionCol";
import type { FacturaCxP } from "@/features/cxp/services";

interface Args {
  rows: FacturaCxP[];
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  seleccionEnLote: boolean;
}

export function useColumnasPorAprobar({ rows, selected, setSelected, seleccionEnLote }: Args) {
  const { idsBloqueados, motivoBloqueo } = useSodAprobacion();
  const bloqueadosSod = useMemo(() => idsBloqueados(rows), [rows, idsBloqueados]);

  const columns = useMemo(() => {
    const base = buildCxPColumns();
    if (!seleccionEnLote) return base;
    return [
      buildSelectionColumn({
        rows,
        selected,
        setSelected,
        bloqueados: bloqueadosSod,
        motivoBloqueo: SOD_MOTIVO_CAPTURA_PROPIA,
      }),
      ...base,
    ];
  }, [rows, selected, setSelected, seleccionEnLote, bloqueadosSod]);

  return { columns, bloqueadosSod, motivoBloqueo };
}
