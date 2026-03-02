import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CONCEPTOS_EMBARQUE } from "@/data/embarqueConstants";

import type { ConceptoVentaLocal as ConceptoVentaRow, ConceptoCostoLocal as ConceptoCostoRow } from "@/data/conceptoTypes";

interface Props {
  conceptosVenta: ConceptoVentaRow[];
  conceptosCosto: ConceptoCostoRow[];
  subtotalVenta: number;
  ivaVenta: number;
  totalVentaConIva: number;
  totalCosto: number;
  ivaCosto: number;
  totalCostoConIva: number;
  utilidadEstimada: number;
  tipoCambioUSD: string;
  setTipoCambioUSD: (v: string) => void;
  tipoCambioEUR: string;
  setTipoCambioEUR: (v: string) => void;
  updateConceptoVenta: (id: number, field: keyof ConceptoVentaRow, value: string | number | boolean) => void;
  addConceptoVenta: () => void;
  removeConceptoVenta: (id: number) => void;
  updateConceptoCosto: (id: number, field: keyof ConceptoCostoRow, value: string | number | boolean) => void;
  addConceptoCosto: () => void;
  removeConceptoCosto: (id: number) => void;
}

export function StepCostosPrecios(props: Props) {
  const {
    conceptosVenta, conceptosCosto,
    subtotalVenta, ivaVenta, totalVentaConIva,
    totalCosto, ivaCosto, totalCostoConIva,
    utilidadEstimada,
    tipoCambioUSD, setTipoCambioUSD, tipoCambioEUR, setTipoCambioEUR,
    updateConceptoVenta, addConceptoVenta, removeConceptoVenta,
    updateConceptoCosto, addConceptoCosto, removeConceptoCosto,
  } = props;

  return (
    <div className="space-y-6">
      {/* Conceptos de Costo */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Conceptos de Costo</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_1fr_100px_90px_50px_100px_40px] gap-2 text-xs font-medium text-muted-foreground">
              <span>Concepto</span><span>Proveedor</span><span>Monto</span><span>Moneda</span><span>IVA</span><span>Total</span><span></span>
            </div>
            {conceptosCosto.map(costo => (
              <div key={costo.id} className="grid grid-cols-[1fr_1fr_100px_90px_50px_100px_40px] gap-2 items-center">
                <Select value={costo.concepto} onValueChange={valor => updateConceptoCosto(costo.id, 'concepto', valor)}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{CONCEPTOS_EMBARQUE.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Proveedor" className="text-sm" value={costo.proveedor} onChange={e => updateConceptoCosto(costo.id, 'proveedor', e.target.value)} />
                <Input type="number" min={0} step="0.01" className="text-sm" value={costo.monto || ''} onChange={e => updateConceptoCosto(costo.id, 'monto', Number(e.target.value))} />
                <Select value={costo.moneda} onValueChange={valor => updateConceptoCosto(costo.id, 'moneda', valor)}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
                </Select>
                <div className="flex justify-center">
                  <Checkbox checked={costo.aplicaIva} onCheckedChange={checked => updateConceptoCosto(costo.id, 'aplicaIva', !!checked)} />
                </div>
                <Input type="number" min={0} step="0.01" className="text-sm" value={costo.total || ''} onChange={e => updateConceptoCosto(costo.id, 'total', Number(e.target.value))} />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeConceptoCosto(costo.id)} disabled={conceptosCosto.length <= 1}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addConceptoCosto}>+ Agregar costo</Button>
            <div className="border-t pt-3 mt-3 text-sm space-y-1">
              <div className="flex justify-end gap-4"><span className="text-muted-foreground">Subtotal:</span><span className="w-28 text-right">${totalCosto.toFixed(2)}</span></div>
              <div className="flex justify-end gap-4"><span className="text-muted-foreground">IVA (16%):</span><span className="w-28 text-right">${ivaCosto.toFixed(2)}</span></div>
              <div className="flex justify-end gap-4"><span className="font-semibold">Total:</span><span className="font-bold w-28 text-right">${totalCostoConIva.toFixed(2)}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conceptos de Venta */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Conceptos de Venta</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_1fr_100px_90px_100px_100px_40px] gap-2 text-xs font-medium text-muted-foreground">
              <span>Concepto</span><span>Proveedor</span><span>Monto</span><span>Moneda</span><span>Subtotal</span><span>Total</span><span></span>
            </div>
            {conceptosVenta.map(venta => (
              <div key={venta.id} className="grid grid-cols-[1fr_1fr_100px_90px_100px_100px_40px] gap-2 items-center">
                <Select value={venta.concepto} onValueChange={valor => updateConceptoVenta(venta.id, 'concepto', valor)}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{CONCEPTOS_EMBARQUE.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Proveedor" className="text-sm" value={venta.proveedor} onChange={e => updateConceptoVenta(venta.id, 'proveedor', e.target.value)} />
                <Input type="number" min={0} step="0.01" className="text-sm" value={venta.monto || ''} onChange={e => updateConceptoVenta(venta.id, 'monto', Number(e.target.value))} />
                <Select value={venta.moneda} onValueChange={valor => updateConceptoVenta(venta.id, 'moneda', valor)}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
                </Select>
                <span className="text-sm text-right">${venta.monto.toFixed(2)}</span>
                <span className="text-sm font-medium text-right">${(venta.monto * 1.16).toFixed(2)}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeConceptoVenta(venta.id)} disabled={conceptosVenta.length <= 1}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addConceptoVenta}>+ Agregar concepto</Button>
            <div className="border-t pt-3 mt-3 text-sm space-y-1">
              <div className="flex justify-end gap-4"><span className="text-muted-foreground">Subtotal:</span><span className="w-28 text-right">${subtotalVenta.toFixed(2)}</span></div>
              <div className="flex justify-end gap-4"><span className="text-muted-foreground">IVA (16%):</span><span className="w-28 text-right">${ivaVenta.toFixed(2)}</span></div>
              <div className="flex justify-end gap-4"><span className="font-semibold">Total:</span><span className="font-bold w-28 text-right">${totalVentaConIva.toFixed(2)}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tipos de cambio y utilidad */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-xs text-muted-foreground">Tipo de Cambio USD</p><Input type="number" value={tipoCambioUSD} onChange={e => setTipoCambioUSD(e.target.value)} className="text-center mt-1" /></div>
            <div><p className="text-xs text-muted-foreground">Tipo de Cambio EUR</p><Input type="number" value={tipoCambioEUR} onChange={e => setTipoCambioEUR(e.target.value)} className="text-center mt-1" /></div>
            <div><p className="text-xs text-muted-foreground">Utilidad Estimada</p><p className={`text-xl font-bold mt-2 ${utilidadEstimada >= 0 ? 'text-success' : 'text-destructive'}`}>${utilidadEstimada.toFixed(2)}</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
