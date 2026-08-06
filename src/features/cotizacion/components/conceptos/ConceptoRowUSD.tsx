import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks";
import { formatCurrency } from "@/lib/formatters";
import { TASAS_IVA_MX, resolverTasaConcepto } from "@/lib/financial/financialUtils";

import { UnidadMedidaSelect } from "./UnidadMedidaSelect";
import { ConceptoDescripcionSelector } from "./ConceptoDescripcionSelector";

export interface ConceptoRowProps {
  concepto: ConceptoVentaCotizacion;
  index: number;
  total: number;
  actualizar: (index: number, campo: string, valor: string | number | boolean) => void;
  eliminar: (index: number) => void;
}

export function ConceptoRowUSD({ concepto: c, index: i, total, actualizar, eliminar }: ConceptoRowProps) {
  const tasaFila = resolverTasaConcepto(c, 0);
  const aplicaIva = tasaFila > 0;
  const puedeIva = !!c.descripcion; // el catálogo determina si es gravado; usuario puede overridear
  return (
    <div className={`grid grid-cols-12 gap-2 items-end rounded-md px-1 py-1 ${aplicaIva ? 'bg-warning/5' : ''}`}>
      <div className="col-span-3">
        {i === 0 && <Label className="text-xs">Concepto</Label>}
        <ConceptoDescripcionSelector descripcion={c.descripcion} index={i} actualizar={actualizar} />
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
          <Select
            value={String(tasaFila)}
            onValueChange={(v) => actualizar(i, 'tasa_iva_aplicada', Number(v))}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASAS_IVA_MX.map(opt => (
                <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          className="h-8 text-xs text-muted-foreground resize-none focus:h-16 transition-all"
          rows={1}
        />
      </div>
    </div>
  );
}
