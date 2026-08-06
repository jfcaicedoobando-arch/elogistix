import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { calcularIVA, resolverTasaConcepto, TASAS_IVA_MX } from "@/lib/financial/financialUtils";
import { UnidadMedidaSelect } from "./UnidadMedidaSelect";
import { ProductoServicioSelect } from "./ProductoServicioSelect";
import { tasaDesdeTipoIva } from "@/features/cotizacion/hooks/useProductosCatalogo";
import type { ConceptoRowProps } from "./ConceptoRowUSD";

export function ConceptoRowMXN({ concepto: c, index: i, total, actualizar, eliminar, tasaIva }: ConceptoRowProps & { tasaIva: number }) {
  const subtotal = c.cantidad * c.precio_unitario;
  const tasaFila = resolverTasaConcepto(c, tasaIva);
  const iva = calcularIVA(subtotal, tasaFila);
  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-2">
        {i === 0 && <Label className="text-xs">Concepto</Label>}
        <ProductoServicioSelect
          value={c.descripcion}
          onSelect={(p) => {
            const tasa = tasaDesdeTipoIva(p.tipo_iva);
            actualizar(i, 'descripcion', p.nombre);
            actualizar(i, 'aplica_iva', p.tipo_iva === 'gravado_16');
            actualizar(i, 'tasa_iva_aplicada', tasa);
            if (p.clave_unidad_sat) actualizar(i, 'unidad_medida', p.clave_unidad_sat);
          }}
        />
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
        {i === 0 && <Label className="text-xs">P. Unitario</Label>}
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
        {i === 0 && <Label className="text-xs">Subtotal</Label>}
        <Input value={formatCurrency(subtotal, 'MXN')} readOnly className="bg-muted" />
      </div>
      <div className="col-span-2">
        {i === 0 && <Label className="text-xs">Tasa IVA</Label>}
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
      </div>
      <div className="col-span-1">
        {i === 0 && <Label className="text-xs">IVA</Label>}
        <Input value={formatCurrency(iva, 'MXN')} readOnly className="bg-muted" />
      </div>
      <div className="col-span-1">
        {i === 0 && <Label className="text-xs">Total</Label>}
        <Input value={formatCurrency(c.total, 'MXN')} readOnly className="bg-muted" />
      </div>
      <div className="col-span-1">
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
