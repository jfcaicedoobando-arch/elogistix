import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { ConceptoVentaCotizacion } from "@/hooks/useCotizaciones";

const CATALOGO_USD = [
  'Flete Marítimo', 'Flete Aéreo', 'Embalaje',
  'Coordinación de Recolección', 'Seguro de Carga',
  'Cargos en Origen', 'Otro',
];

const CATALOGO_MXN = [
  'Manejo', 'Demoras', 'Cargos en Destino',
  'Almacenaje', 'Entrega', 'Otro',
];

interface Props {
  conceptosUSD: ConceptoVentaCotizacion[];
  conceptosMXN: ConceptoVentaCotizacion[];
  actualizarConceptoUSD: (index: number, campo: string, valor: any) => void;
  actualizarConceptoMXN: (index: number, campo: string, valor: any) => void;
  agregarConceptoUSD: () => void;
  agregarConceptoMXN: () => void;
  eliminarConceptoUSD: (index: number) => void;
  eliminarConceptoMXN: (index: number) => void;
  totalUSD: number;
  subtotalMXN: number;
  ivaMXN: number;
  totalMXN: number;
}

const fmt = (value: number, currency: string) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(value);

export default function SeccionConceptosVentaCotizacion({
  conceptosUSD, conceptosMXN,
  actualizarConceptoUSD, actualizarConceptoMXN,
  agregarConceptoUSD, agregarConceptoMXN,
  eliminarConceptoUSD, eliminarConceptoMXN,
  totalUSD, subtotalMXN, ivaMXN, totalMXN,
}: Props) {
  return (
    <div className="space-y-6">
      {/* === TABLA USD === */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Conceptos en USD</CardTitle>
            <Button variant="outline" size="sm" onClick={agregarConceptoUSD}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {conceptosUSD.map((c, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                {i === 0 && <Label className="text-xs">Concepto</Label>}
                {c.descripcion !== '' && !CATALOGO_USD.includes(c.descripcion) && c.descripcion !== 'Otro' ? (
                  // "Otro" with custom text
                  <Input
                    value={c.descripcion}
                    onChange={e => actualizarConceptoUSD(i, 'descripcion', e.target.value)}
                    placeholder="Descripción libre"
                  />
                ) : (
                  <Select
                    value={CATALOGO_USD.includes(c.descripcion) ? c.descripcion : c.descripcion === '' ? '' : 'Otro'}
                    onValueChange={val => {
                      if (val === 'Otro') {
                        actualizarConceptoUSD(i, 'descripcion', '');
                        // Force re-render as custom input
                        setTimeout(() => actualizarConceptoUSD(i, '_esOtro', true), 0);
                      } else {
                        actualizarConceptoUSD(i, 'descripcion', val);
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecciona concepto" /></SelectTrigger>
                    <SelectContent>
                      {CATALOGO_USD.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="col-span-2">
                {i === 0 && <Label className="text-xs">Cantidad</Label>}
                <Input type="number" min={1} value={c.cantidad} onChange={e => actualizarConceptoUSD(i, 'cantidad', Number(e.target.value))} />
              </div>
              <div className="col-span-2">
                {i === 0 && <Label className="text-xs">P. Unitario (USD)</Label>}
                <Input type="number" min={0} step={0.01} value={c.precio_unitario} onChange={e => actualizarConceptoUSD(i, 'precio_unitario', Number(e.target.value))} />
              </div>
              <div className="col-span-2">
                {i === 0 && <Label className="text-xs">Total (USD)</Label>}
                <Input value={c.total.toFixed(2)} readOnly className="bg-muted" />
              </div>
              <div className="col-span-1">
                <Button variant="ghost" size="icon" onClick={() => eliminarConceptoUSD(i)} disabled={conceptosUSD.length <= 1}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex flex-col items-end gap-1 pt-2 border-t">
            <span className="text-sm font-semibold">Total USD: {fmt(totalUSD, 'USD')}</span>
          </div>
        </CardContent>
      </Card>

      {/* === TABLA MXN === */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Conceptos en MXN + IVA</CardTitle>
            <Button variant="outline" size="sm" onClick={agregarConceptoMXN}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {conceptosMXN.map((c, i) => {
            const subtotal = c.cantidad * c.precio_unitario;
            const iva = subtotal * 0.16;
            return (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3">
                  {i === 0 && <Label className="text-xs">Concepto</Label>}
                  {c.descripcion !== '' && !CATALOGO_MXN.includes(c.descripcion) && c.descripcion !== 'Otro' ? (
                    <Input
                      value={c.descripcion}
                      onChange={e => actualizarConceptoMXN(i, 'descripcion', e.target.value)}
                      placeholder="Descripción libre"
                    />
                  ) : (
                    <Select
                      value={CATALOGO_MXN.includes(c.descripcion) ? c.descripcion : c.descripcion === '' ? '' : 'Otro'}
                      onValueChange={val => {
                        if (val === 'Otro') {
                          actualizarConceptoMXN(i, 'descripcion', '');
                          setTimeout(() => actualizarConceptoMXN(i, '_esOtro', true), 0);
                        } else {
                          actualizarConceptoMXN(i, 'descripcion', val);
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecciona concepto" /></SelectTrigger>
                      <SelectContent>
                        {CATALOGO_MXN.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="col-span-1">
                  {i === 0 && <Label className="text-xs">Cant.</Label>}
                  <Input type="number" min={1} value={c.cantidad} onChange={e => actualizarConceptoMXN(i, 'cantidad', Number(e.target.value))} />
                </div>
                <div className="col-span-2">
                  {i === 0 && <Label className="text-xs">P. Unitario</Label>}
                  <Input type="number" min={0} step={0.01} value={c.precio_unitario} onChange={e => actualizarConceptoMXN(i, 'precio_unitario', Number(e.target.value))} />
                </div>
                <div className="col-span-2">
                  {i === 0 && <Label className="text-xs">Subtotal</Label>}
                  <Input value={subtotal.toFixed(2)} readOnly className="bg-muted" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <Label className="text-xs">IVA (16%)</Label>}
                  <Input value={iva.toFixed(2)} readOnly className="bg-muted" />
                </div>
                <div className="col-span-1">
                  {i === 0 && <Label className="text-xs">Total</Label>}
                  <Input value={c.total.toFixed(2)} readOnly className="bg-muted" />
                </div>
                <div className="col-span-1">
                  <Button variant="ghost" size="icon" onClick={() => eliminarConceptoMXN(i)} disabled={conceptosMXN.length <= 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="flex flex-col items-end gap-1 pt-2 border-t">
            <span className="text-sm">Subtotal MXN: {fmt(subtotalMXN, 'MXN')}</span>
            <span className="text-sm">IVA (16%): {fmt(ivaMXN, 'MXN')}</span>
            <span className="text-sm font-semibold">Total MXN: {fmt(totalMXN, 'MXN')}</span>
          </div>
        </CardContent>
      </Card>

      {/* === RESUMEN === */}
      <div className="flex flex-col items-end gap-1 p-4 border rounded-md bg-muted/30">
        <span className="text-base font-bold">Total USD: {fmt(totalUSD, 'USD')}</span>
        <span className="text-base font-bold">Total MXN (c/IVA): {fmt(totalMXN, 'MXN')}</span>
        <span className="text-xs text-muted-foreground">* Los conceptos en MXN incluyen IVA 16%</span>
      </div>
    </div>
  );
}
