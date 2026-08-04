/**
 * Render puro de la lista de conceptos_costo pendientes ya agrupados y filtrados,
 * usado por `VincularEmbarqueSection`.
 */
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/formatters";
import { lineaExcedeOriginal } from "@/features/cxp/utils/topeVinculacion";
import type { ConceptoCostoAbierto } from "@/features/cxp/hooks";
import type { Grupo } from "./vincularEmbarqueHelpers";
import type { SeleccionLinea } from "@/features/cxp/types";

interface Props {
  grupos: Grupo[];
  seleccion: Record<string, SeleccionLinea>;
  onToggle: (concepto: ConceptoCostoAbierto, checked: boolean) => void;
  onChangeMonto: (conceptoId: string, monto: number) => void;
}

export function VincularListaConceptos({ grupos, seleccion, onToggle, onChangeMonto }: Props) {
  if (grupos.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic px-3 py-4 text-center">
        Ningún concepto coincide con el filtro.
      </p>
    );
  }
  return (
    <>
      {grupos.map((g) => (
        <div key={g.embarqueId} className="rounded-md border bg-muted/20">
          <div className="px-3 py-1.5 border-b bg-muted/40 text-xs font-medium">
            Embarque <span className="font-mono">{g.expediente}</span>
          </div>
          <div className="divide-y">
            {g.items.map((it) => {
              const sel = seleccion[it.id];
              const checked = !!sel;
              const excede = checked
                && lineaExcedeOriginal({ monto: sel.monto, montoOriginal: it.monto });
              return (
                <div key={it.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => onToggle(it, !!v)}
                    aria-label={`Vincular ${it.concepto}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="truncate" title={it.concepto}>{it.concepto}</div>
                    <div className="text-xs text-muted-foreground">
                      Cotizado: {formatCurrency(it.monto, it.moneda)}
                      {excede && (
                        <span className="text-destructive ml-1">
                          · el monto asignado supera lo cotizado
                        </span>
                      )}
                    </div>
                  </div>
                  {checked && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{it.moneda}</span>
                      <Input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        value={sel.monto}
                        onChange={(e) => onChangeMonto(it.id, Number(e.target.value) || 0)}
                        aria-invalid={excede || undefined}
                        className={`w-28 h-8 text-right tabular-nums ${
                          excede ? "border-destructive text-destructive" : ""
                        }`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

