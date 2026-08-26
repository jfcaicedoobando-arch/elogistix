/**
 * Render puro de la lista de conceptos_costo pendientes ya agrupados y filtrados,
 * usado por `VincularEmbarqueSection`. El renglón vive en `VincularConceptoRow`
 * (conversión de moneda y T/C implícito).
 */
import { VincularConceptoRow } from "./VincularConceptoRow";
import type { ConceptoCostoAbierto } from "@/features/cxp/hooks";
import type { Grupo } from "./vincularEmbarqueHelpers";
import type { SeleccionLinea } from "@/features/cxp/types";
import type { TcPivote } from "@/features/cxp/utils/vinculoMoneda";

interface Props {
  grupos: Grupo[];
  seleccion: Record<string, SeleccionLinea>;
  onToggle: (concepto: ConceptoCostoAbierto, checked: boolean, montoBase?: number) => void;
  onChangeMonto: (conceptoId: string, monto: number) => void;
  facturaMoneda: string;
  tc: TcPivote | null;
  tcFecha?: string | null;
}

export function VincularListaConceptos({
  grupos, seleccion, onToggle, onChangeMonto, facturaMoneda, tc, tcFecha,
}: Props) {
  if (grupos.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground italic px-3 py-4 text-center">
        Ningún concepto coincide con el filtro.
      </p>
    );
  }
  return (
    <>
      {grupos.map((g) => (
        <div key={g.embarqueId} className="rounded-md border bg-muted/20">
          <div className="px-3 py-1.5 border-b bg-muted/40 text-body-sm font-medium">
            Embarque <span className="font-mono">{g.expediente}</span>
          </div>
          <div className="divide-y">
            {g.items.map((it) => (
              <VincularConceptoRow
                key={it.id}
                concepto={it}
                seleccion={seleccion[it.id]}
                onToggle={onToggle}
                onChangeMonto={onChangeMonto}
                facturaMoneda={facturaMoneda}
                tc={tc}
                tcFecha={tcFecha}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
