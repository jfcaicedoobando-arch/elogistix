/**
 * Tabla editable de conceptos para factura manual.
 * Extraída de DialogNuevaFacturaManual para mantener < 200 LOC.
 */
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";

interface Props {
  conceptos: ConceptoManualInput[];
  moneda: "MXN" | "USD";
  tasaIva: number;
  onChange: (next: ConceptoManualInput[]) => void;
}

export function FacturaManualConceptosTable({ conceptos, moneda, tasaIva, onChange }: Props) {
  const update = (idx: number, patch: Partial<ConceptoManualInput>) => {
    onChange(conceptos.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };
  const add = () => {
    onChange([...conceptos, { descripcion: "", cantidad: 1, precio_unitario: 0, clave_sat: "78101800" }]);
  };
  const remove = (idx: number) => {
    if (conceptos.length === 1) return;
    onChange(conceptos.filter((_, i) => i !== idx));
  };

  const subtotal = conceptos.reduce(
    (acc, c) => acc + Number(c.cantidad || 0) * Number(c.precio_unitario || 0),
    0,
  );
  const iva = Math.round(subtotal * tasaIva * 100) / 100;
  const total = Math.round((subtotal + iva) * 100) / 100;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label>Conceptos *</Label>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4 mr-1" /> Agregar concepto
        </Button>
      </div>
      <div className="border rounded-md divide-y">
        {conceptos.map((c, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 p-3 items-end">
            <div className="col-span-5">
              <Label className="text-xs">Descripción</Label>
              <Input
                value={c.descripcion}
                onChange={(e) => update(idx, { descripcion: e.target.value })}
                placeholder="Ej. Anticipo servicios logísticos"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Clave SAT</Label>
              <Input
                value={c.clave_sat ?? ""}
                onChange={(e) => update(idx, { clave_sat: e.target.value })}
                placeholder="78101800"
              />
            </div>
            <div className="col-span-1">
              <Label className="text-xs">Cant.</Label>
              <Input
                type="number" min={1}
                value={c.cantidad}
                onChange={(e) => update(idx, { cantidad: Number(e.target.value) || 1 })}
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">P. unitario</Label>
              <Input
                type="number" step="0.01" min={0}
                value={c.precio_unitario}
                onChange={(e) => update(idx, { precio_unitario: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="col-span-1 text-right text-sm tabular-nums">
              {formatCurrency(Number(c.cantidad || 0) * Number(c.precio_unitario || 0), moneda)}
            </div>
            <div className="col-span-1 flex justify-end">
              <Button
                type="button" variant="ghost" size="icon"
                onClick={() => remove(idx)}
                disabled={conceptos.length === 1}
                aria-label="Eliminar concepto"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-2 text-sm space-y-0.5 flex-col items-end">
        <div>Subtotal: <span className="tabular-nums font-medium">{formatCurrency(subtotal, moneda)}</span></div>
        <div>IVA ({(tasaIva * 100).toFixed(0)}%): <span className="tabular-nums font-medium">{formatCurrency(iva, moneda)}</span></div>
        <div className="text-base">Total: <span className="tabular-nums font-bold">{formatCurrency(total, moneda)}</span></div>
      </div>
    </div>
  );
}
