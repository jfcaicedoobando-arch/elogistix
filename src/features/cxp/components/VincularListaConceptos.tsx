/**
 * Render puro de la lista de conceptos_costo pendientes ya agrupados y filtrados,
 * usado por `VincularEmbarqueSection`.
 */
import { Checkbox } from "@/components/ui/checkbox";
import { Hint } from "@/components/shared/Hint";
import { MoneyInput } from "@/components/shared/MoneyInput";
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
            {g.items.map((it) => {
              const sel = seleccion[it.id];
              const checked = !!sel;
              const excede = checked
                && lineaExcedeOriginal({ monto: sel.monto, montoOriginal: it.monto });
              return (
                <div key={it.id} className="px-3 py-2 flex items-center gap-3 text-body">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => onToggle(it, !!v)}
                    aria-label={`Vincular ${it.concepto}`}
                  />
                  <div className="flex-1 min-w-0">
                    <Hint label={it.concepto}><div className="truncate">{it.concepto}</div></Hint>
                    <div className="text-body-sm text-muted-foreground">
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
                      <span className="text-body-sm text-muted-foreground">{it.moneda}</span>
                      <MoneyInput
                        value={sel.monto}
                        onChange={(n: number) => onChangeMonto(it.id, n)}
                        aria-invalid={excede || undefined}
                        aria-label={`Importe aplicado al concepto ${it.concepto}`}
                        className={`w-28 h-8 ${excede ? "border-destructive text-destructive" : ""}`}
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

