import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { ConceptoVentaCotizacion } from "@/hooks/useCotizaciones";

interface Props {
  conceptos: ConceptoVentaCotizacion[];
  moneda: string;
  seguro: boolean;
  valorSeguroUsd: number;
  subtotalConceptos: number;
  subtotal: number;
  actualizarConcepto: (index: number, campo: string, valor: any) => void;
  agregarConcepto: () => void;
  eliminarConcepto: (index: number) => void;
}

export default function SeccionConceptosVentaCotizacion({
  conceptos, moneda, seguro, valorSeguroUsd,
  subtotalConceptos, subtotal,
  actualizarConcepto, agregarConcepto, eliminarConcepto,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Conceptos de Venta</CardTitle>
          <Button variant="outline" size="sm" onClick={agregarConcepto}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {conceptos.map((concepto, index) => (
          <div key={index} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-5">
              {index === 0 && <Label className="text-xs">Descripción</Label>}
              <Input value={concepto.descripcion} onChange={e => actualizarConcepto(index, 'descripcion', e.target.value)} placeholder="Concepto" />
            </div>
            <div className="col-span-2">
              {index === 0 && <Label className="text-xs">Cantidad</Label>}
              <Input type="number" min={1} value={concepto.cantidad} onChange={e => actualizarConcepto(index, 'cantidad', Number(e.target.value))} />
            </div>
            <div className="col-span-2">
              {index === 0 && <Label className="text-xs">P. Unitario</Label>}
              <Input type="number" min={0} step={0.01} value={concepto.precio_unitario} onChange={e => actualizarConcepto(index, 'precio_unitario', Number(e.target.value))} />
            </div>
            <div className="col-span-2">
              {index === 0 && <Label className="text-xs">Total</Label>}
              <Input value={concepto.total.toFixed(2)} readOnly className="bg-muted" />
            </div>
            <div className="col-span-1">
              <Button variant="ghost" size="icon" onClick={() => eliminarConcepto(index)} disabled={conceptos.length <= 1}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        <div className="flex flex-col items-end gap-1 pt-2 border-t">
          <span className="text-sm">Conceptos: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(subtotalConceptos)}</span>
          {seguro && <span className="text-sm">Seguro: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' }).format(Number(valorSeguroUsd) || 0)}</span>}
          <span className="text-sm font-semibold">Total: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(subtotal)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
