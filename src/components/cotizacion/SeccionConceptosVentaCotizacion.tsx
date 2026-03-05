import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import type { ConceptoVentaCotizacion } from "@/hooks/useCotizaciones";
import { formatCurrency } from "@/lib/formatters";

const CATALOGO_USD = [
  'Flete Marítimo', 'Flete Aéreo', 'Embalaje',
  'Coordinación de Recolección', 'Seguro de Carga',
  'Cargos en Origen', 'Revalidación', 'Handling',
  'Desconsolidación', 'Entrega Nacional', 'Otro',
];

const CATALOGO_MXN = [
  'Manejo', 'Demoras', 'Cargos en Destino',
  'Almacenaje', 'Entrega', 'Revalidación', 'Handling',
  'Desconsolidación', 'Entrega Nacional', 'Otro',
];

const CONCEPTOS_CON_IVA = ['Handling', 'Desconsolidación', 'Revalidación'];

const UNIDADES_MEDIDA = ['BL', 'W/M', 'Documento', 'Contenedor', 'Kilo', 'Embarque'];

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


function UnidadMedidaSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value || 'sin_unidad'} onValueChange={v => onChange(v === 'sin_unidad' ? '' : v)}>
      <SelectTrigger><SelectValue placeholder="Unidad" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="sin_unidad">—</SelectItem>
        {UNIDADES_MEDIDA.map(u => (
          <SelectItem key={u} value={u}>{u}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { CONCEPTOS_CON_IVA };

export default function SeccionConceptosVentaCotizacion({
  conceptosUSD, conceptosMXN,
  actualizarConceptoUSD, actualizarConceptoMXN,
  agregarConceptoUSD, agregarConceptoMXN,
  eliminarConceptoUSD, eliminarConceptoMXN,
  totalUSD, subtotalMXN, ivaMXN, totalMXN,
}: Props) {
  const hayIvaUSD = conceptosUSD.some(c => c.aplica_iva);
  const subtotalSinIvaUSD = conceptosUSD.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0);
  const ivaUSD = totalUSD - subtotalSinIvaUSD;

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
          {conceptosUSD.map((c, i) => {
            const puedeIva = CONCEPTOS_CON_IVA.includes(c.descripcion);
            return (
              <div key={i} className={`grid grid-cols-12 gap-2 items-end rounded-md px-1 py-1 ${c.aplica_iva ? 'bg-amber-50/30' : ''}`}>
                <div className="col-span-3">
                  {i === 0 && <Label className="text-xs">Concepto</Label>}
                  {c.descripcion !== '' && !CATALOGO_USD.includes(c.descripcion) && c.descripcion !== 'Otro' ? (
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
                          setTimeout(() => actualizarConceptoUSD(i, '_esOtro', true), 0);
                        } else {
                          actualizarConceptoUSD(i, 'descripcion', val);
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecciona concepto" /></SelectTrigger>
                      <SelectContent>
                        {CATALOGO_USD.map(opt => (
                          <SelectItem key={opt} value={opt}>
                            {CONCEPTOS_CON_IVA.includes(opt) ? `${opt} *` : opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="col-span-1">
                  {i === 0 && <Label className="text-xs">Unidad</Label>}
                  <UnidadMedidaSelect value={c.unidad_medida} onChange={v => actualizarConceptoUSD(i, 'unidad_medida', v)} />
                </div>
                <div className="col-span-1">
                  {i === 0 && <Label className="text-xs">Cant.</Label>}
                  <Input
                    type="text" inputMode="numeric"
                    value={c.cantidad === 0 ? '' : c.cantidad}
                    onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      actualizarConceptoUSD(i, 'cantidad', raw === '' ? 0 : parseInt(raw, 10));
                    }}
                    onBlur={e => { if (e.target.value === '') actualizarConceptoUSD(i, 'cantidad', 1); }}
                    placeholder="1"
                  />
                </div>
                <div className="col-span-2">
                  {i === 0 && <Label className="text-xs">P. Unitario (USD)</Label>}
                  <Input
                    type="text" inputMode="decimal"
                    value={c.precio_unitario === 0 ? '' : c.precio_unitario}
                    onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9.]/g, '');
                      actualizarConceptoUSD(i, 'precio_unitario', raw === '' ? 0 : parseFloat(raw));
                    }}
                    onBlur={e => { if (e.target.value === '') actualizarConceptoUSD(i, 'precio_unitario', 0); }}
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-1">
                  {i === 0 && <Label className="text-xs">IVA</Label>}
                  {puedeIva ? (
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={c.aplica_iva}
                        onCheckedChange={checked => actualizarConceptoUSD(i, 'aplica_iva', checked)}
                      />
                      <span className={`text-xs font-medium ${c.aplica_iva ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        {c.aplica_iva ? '16%' : 'No'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center h-10">—</span>
                  )}
                </div>
                <div className="col-span-2">
                  {i === 0 && <Label className="text-xs">Total (USD)</Label>}
                  <Input value={formatCurrency(c.total, 'USD')} readOnly className="bg-muted" />
                </div>
                <div className="col-span-1">
                  {i === 0 && <Label className="text-xs">&nbsp;</Label>}
                  <Button variant="ghost" size="icon" onClick={() => eliminarConceptoUSD(i)} disabled={conceptosUSD.length <= 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="flex flex-col items-end gap-1 pt-2 border-t">
            {hayIvaUSD ? (
              <>
                <span className="text-sm">Subtotal s/IVA: {formatCurrency(subtotalSinIvaUSD, 'USD')}</span>
                <span className="text-sm text-amber-600">IVA 16%: {formatCurrency(ivaUSD, 'USD')}</span>
                <span className="text-sm font-semibold">Total USD: {formatCurrency(totalUSD, 'USD')}</span>
              </>
            ) : (
              <span className="text-sm font-semibold">Total USD: {formatCurrency(totalUSD, 'USD')}</span>
            )}
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
                <div className="col-span-2">
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
                  {i === 0 && <Label className="text-xs">Unidad</Label>}
                  <UnidadMedidaSelect value={c.unidad_medida} onChange={v => actualizarConceptoMXN(i, 'unidad_medida', v)} />
                </div>
                <div className="col-span-1">
                  {i === 0 && <Label className="text-xs">Cant.</Label>}
                  <Input
                    type="text" inputMode="numeric"
                    value={c.cantidad === 0 ? '' : c.cantidad}
                    onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      actualizarConceptoMXN(i, 'cantidad', raw === '' ? 0 : parseInt(raw, 10));
                    }}
                    onBlur={e => { if (e.target.value === '') actualizarConceptoMXN(i, 'cantidad', 1); }}
                    placeholder="1"
                  />
                </div>
                <div className="col-span-2">
                  {i === 0 && <Label className="text-xs">P. Unitario</Label>}
                  <Input
                    type="text" inputMode="decimal"
                    value={c.precio_unitario === 0 ? '' : c.precio_unitario}
                    onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9.]/g, '');
                      actualizarConceptoMXN(i, 'precio_unitario', raw === '' ? 0 : parseFloat(raw));
                    }}
                    onBlur={e => { if (e.target.value === '') actualizarConceptoMXN(i, 'precio_unitario', 0); }}
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-2">
                  {i === 0 && <Label className="text-xs">Subtotal</Label>}
                  <Input value={formatCurrency(subtotal, 'MXN')} readOnly className="bg-muted" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <Label className="text-xs">IVA (16%)</Label>}
                  <Input value={formatCurrency(iva, 'MXN')} readOnly className="bg-muted" />
                </div>
                <div className="col-span-1">
                  {i === 0 && <Label className="text-xs">Total</Label>}
                  <Input value={formatCurrency(c.total, 'MXN')} readOnly className="bg-muted" />
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
            <span className="text-sm">Subtotal MXN: {formatCurrency(subtotalMXN, 'MXN')}</span>
            <span className="text-sm">IVA (16%): {formatCurrency(ivaMXN, 'MXN')}</span>
            <span className="text-sm font-semibold">Total MXN: {formatCurrency(totalMXN, 'MXN')}</span>
          </div>
        </CardContent>
      </Card>

      {/* === RESUMEN === */}
      <div className="flex flex-col items-end gap-1 p-4 border rounded-md bg-muted/30">
        <span className="text-base font-bold">Total USD: {formatCurrency(totalUSD, 'USD')}</span>
        <span className="text-base font-bold">Total MXN (c/IVA): {formatCurrency(totalMXN, 'MXN')}</span>
        <span className="text-xs text-muted-foreground">* Los conceptos en MXN incluyen IVA 16%</span>
        {hayIvaUSD && <span className="text-xs text-amber-600">* Algunos conceptos USD incluyen IVA 16%</span>}
      </div>
    </div>
  );
}
