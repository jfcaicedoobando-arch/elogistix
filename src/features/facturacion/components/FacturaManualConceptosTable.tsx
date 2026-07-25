/**
 * Tabla editable de conceptos para factura manual.
 * Cada renglón lleva su propio régimen de IVA (16% / 0% / Exento) que se
 * suma renglón por renglón en el pie de totales.
 */
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/shared/NumericInput";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";
import type { ConceptoManualInput } from "@/features/facturacion/services/facturaManual";
import type { TipoIvaConcepto } from "@/features/facturacion/services/conceptosFacturaCrud";

interface Props {
  conceptos: ConceptoManualInput[];
  moneda: "MXN" | "USD" | "EUR";
  tasaIva: number;
  onChange: (next: ConceptoManualInput[]) => void;
}

function tasaDeTipo(tipo: TipoIvaConcepto, tasaIva: number): number {
  if (tipo === "gravado_16") return tasaIva;
  if (tipo === "tasa_0") return 0;
  return 0; // exento no aporta IVA
}

export function FacturaManualConceptosTable({ conceptos, moneda, tasaIva, onChange }: Props) {
  const update = (idx: number, patch: Partial<ConceptoManualInput>) => {
    onChange(conceptos.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };
  const add = () => {
    onChange([...conceptos, { descripcion: "", cantidad: 1, precio_unitario: 0, clave_sat: "78101800", tipo_iva: "gravado_16" }]);
  };
  const remove = (idx: number) => {
    if (conceptos.length === 1) return;
    onChange(conceptos.filter((_, i) => i !== idx));
  };

  const subtotal = conceptos.reduce(
    (acc, c) => acc + Number(c.cantidad || 0) * Number(c.precio_unitario || 0),
    0,
  );
  const iva = conceptos.reduce((acc, c) => {
    const importe = Number(c.cantidad || 0) * Number(c.precio_unitario || 0);
    return acc + importe * tasaDeTipo(c.tipo_iva ?? "gravado_16", tasaIva);
  }, 0);
  const ivaR = Math.round(iva * 100) / 100;
  const subtotalR = Math.round(subtotal * 100) / 100;
  const total = Math.round((subtotalR + ivaR) * 100) / 100;

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
            <div className="col-span-4">
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
              <NumericInput
                aria-label="Cantidad"
                value={c.cantidad || 0}
                onChange={(n) => update(idx, { cantidad: n || 1 })}
                className="h-10"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">P. unitario</Label>
              <NumericInput
                aria-label="Precio unitario"
                decimals
                value={c.precio_unitario || 0}
                onChange={(n) => update(idx, { precio_unitario: n })}
                className="h-10"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">IVA</Label>
              <Select
                value={c.tipo_iva ?? "gravado_16"}
                onValueChange={(v) => update(idx, { tipo_iva: v as TipoIvaConcepto })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gravado_16">IVA 16%</SelectItem>
                  <SelectItem value="tasa_0">Tasa 0%</SelectItem>
                  <SelectItem value="exento">Exento</SelectItem>
                </SelectContent>
              </Select>
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
            <div className="col-span-12 text-right text-xs tabular-nums text-muted-foreground">
              Importe: {formatCurrency(Number(c.cantidad || 0) * Number(c.precio_unitario || 0), moneda)}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end mt-2 text-sm space-y-0.5 flex-col items-end">
        <div>Subtotal: <span className="tabular-nums font-medium">{formatCurrency(subtotalR, moneda)}</span></div>
        <div>IVA: <span className="tabular-nums font-medium">{formatCurrency(ivaR, moneda)}</span></div>
        <div className="text-base">Total: <span className="tabular-nums font-bold">{formatCurrency(total, moneda)}</span></div>
      </div>
    </div>
  );
}
