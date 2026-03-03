import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { CATALOGO_CONCEPTOS } from "@/data/embarqueConstants";
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
  const formatCurrency = (value: number, currency: string) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(value);

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
              {index === 0 && <Label className="text-xs">Concepto</Label>}
              <Select
                value={concepto.descripcion}
                onValueChange={(val) => actualizarConcepto(index, 'descripcion', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona concepto" />
                </SelectTrigger>
                <SelectContent>
                  {CATALOGO_CONCEPTOS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <span className="text-sm">Conceptos: {formatCurrency(subtotalConceptos, moneda)}</span>
          {seguro && <span className="text-sm">Seguro: {formatCurrency(Number(valorSeguroUsd) || 0, 'USD')}</span>}
          <span className="text-sm font-semibold">Total: {formatCurrency(subtotal, moneda)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
