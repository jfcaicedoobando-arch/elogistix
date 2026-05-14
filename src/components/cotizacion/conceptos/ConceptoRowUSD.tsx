import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";
import type { ConceptoVentaCotizacion } from "@/hooks/cotizacion/useCotizaciones";
import { formatCurrency } from "@/lib/formatters";
import { CONCEPTOS_COSTO_USD, CONCEPTOS_CON_IVA_USD } from "@/constants/cotizacionConstants";
import { UnidadMedidaSelect } from "./UnidadMedidaSelect";

export interface ConceptoRowProps {
  concepto: ConceptoVentaCotizacion;
  index: number;
  total: number;
  actualizar: (index: number, campo: string, valor: string | number | boolean) => void;
  eliminar: (index: number) => void;
}

/** Resuelve el value del Select de concepto: catálogo, vacío o "Otro". */
function getConceptoSelectValue(descripcion: string, catalogo: readonly string[]): string {
  if (catalogo.includes(descripcion)) return descripcion;
  if (descripcion === "") return "";
  return "Otro";
}

export function ConceptoRowUSD({ concepto: c, index: i, total, actualizar, eliminar }: ConceptoRowProps) {
  const puedeIva = (CONCEPTOS_CON_IVA_USD as readonly string[]).includes(c.descripcion);
  return (
    <div className={`grid grid-cols-12 gap-2 items-end rounded-md px-1 py-1 ${c.aplica_iva ? 'bg-warning/5' : ''}`}>
      <div className="col-span-3">
        {i === 0 && <Label className="text-xs">Concepto</Label>}
        {c.descripcion !== '' && !(CONCEPTOS_COSTO_USD as readonly string[]).includes(c.descripcion) && c.descripcion !== 'Otro' ? (
          <Input
            value={c.descripcion}
            onChange={e => actualizar(i, 'descripcion', e.target.value)}
            placeholder="Descripción libre"
          />
        ) : (
          <Select
            value={getConceptoSelectValue(c.descripcion, CONCEPTOS_COSTO_USD as readonly string[])}
            onValueChange={val => {
              if (val === 'Otro') {
                actualizar(i, 'descripcion', '');
                actualizar(i, 'aplica_iva', false);
                setTimeout(() => actualizar(i, '_esOtro', true), 0);
              } else {
                actualizar(i, 'descripcion', val);
                actualizar(i, 'aplica_iva', (CONCEPTOS_CON_IVA_USD as readonly string[]).includes(val));
              }
            }}
          >
            <SelectTrigger><SelectValue placeholder="Selecciona concepto" /></SelectTrigger>
            <SelectContent>
              {[...CONCEPTOS_COSTO_USD].map(opt => (
                <SelectItem key={opt} value={opt}>
                  {(CONCEPTOS_CON_IVA_USD as readonly string[]).includes(opt) ? `${opt} *` : opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="col-span-1">
        {i === 0 && <Label className="text-xs">Unidad</Label>}
        <UnidadMedidaSelect value={c.unidad_medida} onChange={v => actualizar(i, 'unidad_medida', v)} />
      </div>
      <div className="col-span-1">
        {i === 0 && <Label className="text-xs">Cant.</Label>}
        <Input
          type="text" inputMode="numeric"
          value={c.cantidad === 0 ? '' : c.cantidad}
          onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
          onChange={e => {
            const raw = e.target.value.replace(/[^0-9]/g, '');
            actualizar(i, 'cantidad', raw === '' ? 0 : parseInt(raw, 10));
          }}
          onBlur={e => { if (e.target.value === '') actualizar(i, 'cantidad', 1); }}
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
            actualizar(i, 'precio_unitario', raw === '' ? 0 : parseFloat(raw));
          }}
          onBlur={e => { if (e.target.value === '') actualizar(i, 'precio_unitario', 0); }}
          placeholder="0.00"
        />
      </div>
      <div className="col-span-1">
        {i === 0 && <Label className="text-xs">IVA</Label>}
        {puedeIva ? (
          <div className="flex items-center gap-1">
            <Switch
              checked={c.aplica_iva}
              onCheckedChange={checked => actualizar(i, 'aplica_iva', checked)}
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
        <Button variant="ghost" size="icon" onClick={() => eliminar(i)} disabled={total <= 1} aria-label="Eliminar concepto">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <div className="col-span-12 -mt-1 mb-1">
        <Textarea
          value={c.notas || ''}
          onChange={e => actualizar(i, 'notas', e.target.value)}
          placeholder="Notas (opcional)"
          className="min-h-[32px] h-8 text-xs text-muted-foreground resize-none focus:h-16 transition-all"
          rows={1}
        />
      </div>
    </div>
  );
}
