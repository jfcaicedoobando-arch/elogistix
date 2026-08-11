/**
 * v13.510.0 — Reparte los grupos de conceptos entre el expediente del documento
 * del buzón (arriba, expandido) y el resto de embarques del proveedor
 * (colapsados detrás de un enlace).
 */
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VincularListaConceptos } from "./VincularListaConceptos";
import { separarGrupoPrioritario, type Grupo } from "./vincularEmbarqueHelpers";
import type { ConceptoCostoAbierto } from "@/features/cxp/hooks";
import type { SeleccionLinea } from "@/features/cxp/types";

interface Props {
  grupos: Grupo[];
  seleccion: Record<string, SeleccionLinea>;
  onToggle: (concepto: ConceptoCostoAbierto, checked: boolean) => void;
  onChangeMonto: (conceptoId: string, monto: number) => void;
  /** Embarque del documento del buzón (si la captura viene de ahí). */
  embarqueIdPrioritario?: string | null;
  expedientePrioritario?: string | null;
}

export function VincularGruposSplit({
  grupos, seleccion, onToggle, onChangeMonto,
  embarqueIdPrioritario, expedientePrioritario,
}: Props) {
  const [verOtros, setVerOtros] = useState(false);
  const { prioritario, otros } = separarGrupoPrioritario(grupos, embarqueIdPrioritario);

  if (!embarqueIdPrioritario) {
    return (
      <VincularListaConceptos
        grupos={grupos}
        seleccion={seleccion}
        onToggle={onToggle}
        onChangeMonto={onChangeMonto}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-label font-medium text-info">Expediente del documento</p>
        {prioritario ? (
          <VincularListaConceptos
            grupos={[prioritario]}
            seleccion={seleccion}
            onToggle={onToggle}
            onChangeMonto={onChangeMonto}
          />
        ) : (
          <p className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
            El expediente {expedientePrioritario ?? "del documento"} no tiene costos pendientes de
            este proveedor: ya están facturados o no se capturó el costo.
          </p>
        )}
      </div>

      {otros.length > 0 && (
        <div className="space-y-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-1 text-xs text-muted-foreground"
            onClick={() => setVerOtros((v) => !v)}
            aria-expanded={verOtros}
          >
            {verOtros
              ? <ChevronDown className="mr-1 h-3.5 w-3.5" />
              : <ChevronRight className="mr-1 h-3.5 w-3.5" />}
            {verOtros
              ? "Ocultar otros embarques"
              : `Ver otros ${otros.length} embarque${otros.length === 1 ? "" : "s"} con costos pendientes`}
          </Button>
          {verOtros && (
            <VincularListaConceptos
              grupos={otros}
              seleccion={seleccion}
              onToggle={onToggle}
              onChangeMonto={onChangeMonto}
            />
          )}
        </div>
      )}
    </div>
  );
}
