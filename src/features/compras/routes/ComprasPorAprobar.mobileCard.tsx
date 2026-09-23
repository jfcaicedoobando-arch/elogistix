import { ComprasPorAprobarMobileCard } from "@/features/compras/components/ComprasPorAprobarMobileCard";
import { SOD_MOTIVO_CAPTURA_PROPIA } from "@/features/cxp/permissions";
import type { FacturaCxP } from "@/features/cxp/services";

interface Props {
  row: FacturaCxP;
  seleccionEnLote: boolean;
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  bloqueadosSod: Set<string>;
  motivoBloqueo: (createdBy: string | null | undefined) => string | null;
}

export function ComprasPorAprobarMobileRow({
  row, seleccionEnLote, selected, setSelected, bloqueadosSod, motivoBloqueo,
}: Props) {
  return (
    <ComprasPorAprobarMobileCard
      row={row}
      seleccionable={seleccionEnLote}
      selected={selected.has(row.id)}
      bloqueada={bloqueadosSod.has(row.id)}
      motivoBloqueo={motivoBloqueo(row.created_by) ?? SOD_MOTIVO_CAPTURA_PROPIA}
      onSelectedChange={(checked) => setSelected((prev) => {
        const next = new Set(prev);
        if (checked) next.add(row.id);
        else next.delete(row.id);
        return next;
      })}
    />
  );
}