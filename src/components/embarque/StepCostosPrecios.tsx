import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONCEPTOS_MARITIMOS } from "@/data/embarqueConstants";

interface ConceptoVentaRow { id: number; concepto: string; cantidad: number; precioUnitario: number; moneda: string; }
interface ConceptoCostoRow { id: number; proveedorId: string; concepto: string; monto: number; moneda: string; }

interface Proveedor {
  id: string;
  nombre: string;
}

interface Props {
  modo: string;
  conceptosVenta: ConceptoVentaRow[];
  conceptosCosto: ConceptoCostoRow[];
  proveedoresDb: Proveedor[];
  subtotalVenta: number;
  totalCosto: number;
  utilidadEstimada: number;
  tipoCambioUSD: string;
  setTipoCambioUSD: (v: string) => void;
  tipoCambioEUR: string;
  setTipoCambioEUR: (v: string) => void;
  updateConceptoVenta: (id: number, field: keyof ConceptoVentaRow, value: string | number) => void;
  addConceptoVenta: () => void;
  removeConceptoVenta: (id: number) => void;
  updateConceptoCosto: (id: number, field: keyof ConceptoCostoRow, value: string | number) => void;
  addConceptoCosto: () => void;
  removeConceptoCosto: (id: number) => void;
}

export function StepCostosPrecios(props: Props) {
  const {
    modo, conceptosVenta, conceptosCosto, proveedoresDb,
    subtotalVenta, totalCosto, utilidadEstimada,
    tipoCambioUSD, setTipoCambioUSD, tipoCambioEUR, setTipoCambioEUR,
    updateConceptoVenta, addConceptoVenta, removeConceptoVenta,
    updateConceptoCosto, addConceptoCosto, removeConceptoCosto,
  } = props;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-sm">Conceptos de Venta</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_80px_100px_90px_100px_40px] gap-2 text-xs font-medium text-muted-foreground">
              <span>Concepto</span><span>Cantidad</span><span>P. Unitario</span><span>Moneda</span><span>Total</span><span></span>
            </div>
            {conceptosVenta.map(cv => (
              <div key={cv.id} className="grid grid-cols-[1fr_80px_100px_90px_100px_40px] gap-2 items-center">
                {modo === 'Marítimo' ? (
                  <Select value={cv.concepto} onValueChange={v => updateConceptoVenta(cv.id, 'concepto', v)}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{CONCEPTOS_MARITIMOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input placeholder="Concepto" className="text-sm" value={cv.concepto} onChange={e => updateConceptoVenta(cv.id, 'concepto', e.target.value)} />
                )}
                <Input type="number" min={1} className="text-sm" value={cv.cantidad} onChange={e => updateConceptoVenta(cv.id, 'cantidad', Number(e.target.value))} />
                <Input type="number" min={0} step="0.01" className="text-sm" value={cv.precioUnitario || ''} onChange={e => updateConceptoVenta(cv.id, 'precioUnitario', Number(e.target.value))} />
                <Select value={cv.moneda} onValueChange={v => updateConceptoVenta(cv.id, 'moneda', v)}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
                </Select>
                <Input readOnly value={`$${(cv.cantidad * cv.precioUnitario).toFixed(2)}`} className="text-sm bg-muted" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeConceptoVenta(cv.id)} disabled={conceptosVenta.length <= 1}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addConceptoVenta}>+ Agregar concepto</Button>
            <div className="border-t pt-3 mt-3 text-sm text-right">
              <div className="flex justify-end gap-4"><span className="font-semibold">Subtotal (Sin IVA):</span><span className="font-bold w-28 text-right">${subtotalVenta.toFixed(2)}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Conceptos de Costo</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_1fr_100px_90px_100px_40px] gap-2 text-xs font-medium text-muted-foreground">
              <span>Proveedor</span><span>Concepto</span><span>Monto</span><span>Moneda</span><span>Total</span><span></span>
            </div>
            {conceptosCosto.map(cc => (
              <div key={cc.id} className="grid grid-cols-[1fr_1fr_100px_90px_100px_40px] gap-2 items-center">
                <Select value={cc.proveedorId} onValueChange={v => updateConceptoCosto(cc.id, 'proveedorId', v)}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Proveedor" /></SelectTrigger>
                  <SelectContent>{proveedoresDb.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre.split(' ').slice(0, 2).join(' ')}</SelectItem>)}</SelectContent>
                </Select>
                {modo === 'Marítimo' ? (
                  <Select value={cc.concepto} onValueChange={v => updateConceptoCosto(cc.id, 'concepto', v)}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{CONCEPTOS_MARITIMOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input placeholder="Concepto" className="text-sm" value={cc.concepto} onChange={e => updateConceptoCosto(cc.id, 'concepto', e.target.value)} />
                )}
                <Input type="number" min={0} step="0.01" className="text-sm" value={cc.monto || ''} onChange={e => updateConceptoCosto(cc.id, 'monto', Number(e.target.value))} />
                <Select value={cc.moneda} onValueChange={v => updateConceptoCosto(cc.id, 'moneda', v)}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
                </Select>
                <Input readOnly value={`$${cc.monto.toFixed(2)}`} className="text-sm bg-muted" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeConceptoCosto(cc.id)} disabled={conceptosCosto.length <= 1}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addConceptoCosto}>+ Agregar costo</Button>
          </div>
        </CardContent>
      </Card>
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
