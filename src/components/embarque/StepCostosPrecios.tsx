import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { convertirAUSD, type Moneda } from "@/lib/financialUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATALOGO_CONCEPTOS } from "@/data/embarqueConstants";

import type { ConceptoVentaLocal as ConceptoVentaRow, ConceptoCostoLocal as ConceptoCostoRow } from "@/data/conceptoTypes";

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
  updateConceptoVenta: (id: number, field: keyof ConceptoVentaRow, value: string | number | boolean) => void;
  addConceptoVenta: () => void;
  removeConceptoVenta: (id: number) => void;
  updateConceptoCosto: (id: number, field: keyof ConceptoCostoRow, value: string | number | boolean) => void;
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

  const tcUSD = parseFloat(tipoCambioUSD) || 1;
  const tcEUR = parseFloat(tipoCambioEUR) || 1;

  const toUSD = (monto: number, moneda: string) =>
    convertirAUSD(monto, moneda as Moneda, tcUSD, tcEUR);

  const totalCostoUSD = useMemo(
    () => conceptosCosto.reduce((acc, c) => acc + toUSD(c.monto, c.moneda), 0),
    [conceptosCosto, tcUSD, tcEUR]
  );
  const totalVentaUSD = useMemo(
    () => conceptosVenta.reduce((acc, v) => acc + toUSD(v.precioUnitario, v.moneda), 0),
    [conceptosVenta, tcUSD, tcEUR]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-sm">Conceptos de Costo</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_1fr_120px_90px_110px_40px] gap-2 text-xs font-medium text-muted-foreground">
              <span>Proveedor</span><span>Concepto</span><span>Subtotal (sin IVA)</span><span>Moneda</span><span>Total USD</span><span></span>
            </div>
            {conceptosCosto.map(costo => {
              const totalUSD = toUSD(costo.monto, costo.moneda);
              return (
                <div key={costo.id} className="grid grid-cols-[1fr_1fr_120px_90px_110px_40px] gap-2 items-center">
                  <Select value={costo.proveedorId} onValueChange={v => updateConceptoCosto(costo.id, 'proveedorId', v)}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Proveedor" /></SelectTrigger>
                    <SelectContent>{proveedoresDb.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre.split(' ').slice(0, 2).join(' ')}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={costo.concepto} onValueChange={v => updateConceptoCosto(costo.id, 'concepto', v)}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{CATALOGO_CONCEPTOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" min={0} step="0.01" className="text-sm" value={costo.monto || ''} onChange={e => updateConceptoCosto(costo.id, 'monto', Number(e.target.value))} />
                  <Select value={costo.moneda} onValueChange={v => updateConceptoCosto(costo.id, 'moneda', v)}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
                  </Select>
                  <Input readOnly value={formatCurrency(totalUSD, 'USD')} className="text-sm bg-muted font-semibold" />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeConceptoCosto(costo.id)} disabled={conceptosCosto.length <= 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={addConceptoCosto}>+ Agregar costo</Button>
            <div className="border-t pt-3 mt-3 text-sm text-right">
              <div className="flex justify-end gap-4"><span className="font-semibold">Total USD:</span><span className="font-bold w-28 text-right">{formatCurrency(totalCostoUSD, 'USD')}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Conceptos de Venta</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_80px_120px_90px_110px_40px] gap-2 text-xs font-medium text-muted-foreground">
              <span>Concepto</span><span>Cantidad</span><span>Subtotal (sin IVA)</span><span>Moneda</span><span>Total USD</span><span></span>
            </div>
            {conceptosVenta.map(venta => {
              const totalUSD = toUSD(venta.precioUnitario, venta.moneda);
              return (
                <div key={venta.id} className="grid grid-cols-[1fr_80px_120px_90px_110px_40px] gap-2 items-center">
                  <Select value={venta.concepto} onValueChange={v => updateConceptoVenta(venta.id, 'concepto', v)}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{CATALOGO_CONCEPTOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" min={1} className="text-sm" value={venta.cantidad} onChange={e => updateConceptoVenta(venta.id, 'cantidad', Number(e.target.value))} />
                  <Input type="number" min={0} step="0.01" className="text-sm" value={venta.precioUnitario || ''} onChange={e => updateConceptoVenta(venta.id, 'precioUnitario', Number(e.target.value))} />
                  <Select value={venta.moneda} onValueChange={v => updateConceptoVenta(venta.id, 'moneda', v)}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
                  </Select>
                  <Input readOnly value={formatCurrency(totalUSD, 'USD')} className="text-sm bg-muted font-semibold" />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeConceptoVenta(venta.id)} disabled={conceptosVenta.length <= 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={addConceptoVenta}>+ Agregar concepto</Button>
            <div className="border-t pt-3 mt-3 text-sm text-right">
              <div className="flex justify-end gap-4"><span className="font-semibold">Total USD:</span><span className="font-bold w-28 text-right">{formatCurrency(totalVentaUSD, 'USD')}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className="text-xs text-muted-foreground">Tipo de Cambio USD</p><Input type="number" value={tipoCambioUSD} onChange={e => setTipoCambioUSD(e.target.value)} className="text-center mt-1" /></div>
            <div><p className="text-xs text-muted-foreground">Tipo de Cambio EUR</p><Input type="number" value={tipoCambioEUR} onChange={e => setTipoCambioEUR(e.target.value)} className="text-center mt-1" /></div>
            <div><p className="text-xs text-muted-foreground">Utilidad Estimada (USD)</p><p className={`text-xl font-bold mt-2 ${utilidadEstimada >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(totalVentaUSD - totalCostoUSD, 'USD')}</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
