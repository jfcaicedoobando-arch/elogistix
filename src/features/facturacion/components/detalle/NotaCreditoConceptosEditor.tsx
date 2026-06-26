/**
 * Editor de conceptos para DialogCrearNotaCredito. Extraído para
 * mantener el dialog ≤ 200 líneas.
 */
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";

interface Props {
  conceptos: ConceptoNotaCredito[];
  monto: number;
  monedaFactura: string;
  excedeSaldo: boolean;
  onAdd: () => void;
  onUpdate: (i: number, patch: Partial<ConceptoNotaCredito>) => void;
  onRemove: (i: number) => void;
}

export function NotaCreditoConceptosEditor(props: Props) {
  const { conceptos, monto, monedaFactura, excedeSaldo, onAdd, onUpdate, onRemove } = props;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Conceptos *</Label>
        <Button type="button" variant="ghost" size="sm" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
        </Button>
      </div>
      <div className="space-y-2">
        {conceptos.map((c, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2">
            <div className="col-span-12 sm:col-span-5 space-y-1">
              <Label className="text-xs">Descripción</Label>
              <Input
                value={c.descripcion}
                onChange={(e) => onUpdate(i, { descripcion: e.target.value })}
                placeholder="Descripción del concepto"
              />
            </div>
            <div className="col-span-3 sm:col-span-2 space-y-1">
              <Label className="text-xs">Cant.</Label>
              <Input
                type="number" min="0.01" step="0.01" value={c.cantidad}
                onChange={(e) => onUpdate(i, { cantidad: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-5 sm:col-span-2 space-y-1">
              <Label className="text-xs">P. Unitario</Label>
              <Input
                type="number" min="0" step="0.01" value={c.precio_unitario}
                onChange={(e) => onUpdate(i, { precio_unitario: Number(e.target.value) })}
              />
            </div>
            <div className="col-span-3 sm:col-span-2 space-y-1">
              <Label className="text-xs">Clave SAT</Label>
              <Input
                value={c.clave_sat ?? ""}
                onChange={(e) => onUpdate(i, { clave_sat: e.target.value })}
              />
            </div>
            <div className="col-span-1 flex justify-end">
              <Button
                type="button" variant="ghost" size="icon"
                onClick={() => onRemove(i)} disabled={conceptos.length === 1}
                aria-label="Eliminar concepto"
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end text-sm pt-1">
        <span className="text-muted-foreground mr-2">Total:</span>
        <strong className={`tabular-nums ${excedeSaldo ? "text-destructive" : ""}`}>
          {monto.toFixed(2)} {monedaFactura}
        </strong>
      </div>
      {excedeSaldo && (
        <p className="text-xs text-destructive">El monto excede el saldo de la factura.</p>
      )}
    </div>
  );
}
