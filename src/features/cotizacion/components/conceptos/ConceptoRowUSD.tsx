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
import { useNumericField } from "@/features/cotizacion/hooks/useNumericField";
import { parseCantidad } from "@/features/cotizacion/utils/parseInputNumero";

export interface ConceptoRowProps {
  concepto: ConceptoVentaCotizacion;
  index: number;
  total: number;
  actualizar: (index: number, campo: string, valor: string | number | boolean) => void;
  eliminar: (index: number) => void;
}

/**
 * VIS-CE-251-07 (R257-01/02): la captura de Cant./P. Unitario usa
 * `useNumericField` (texto crudo mientras hay foco, confirmación en blur), así
 * `1.5` ya no se convierte en `15`. La selección de catálogo sigue en
 * `ConceptoDescripcionSelector` y la tasa de IVA se escribe UNA sola vez
 * (`tasa_iva_aplicada`) para que el hook no la pise con la tasa general.
 */
export function ConceptoRowUSD({ concepto: c, index: i, total, actualizar, eliminar }: ConceptoRowProps) {
  const cantidad = useNumericField(c.cantidad, (n) => actualizar(i, "cantidad", n), { parse: parseCantidad, fallback: 1 });
  const precio = useNumericField(c.precio_unitario, (n) => actualizar(i, "precio_unitario", n));
  const tasaFila = resolverTasaConcepto(c, 0);
  const aplicaIva = tasaFila > 0;
  const puedeIva = !!c.descripcion; // el catálogo determina si es gravado; usuario puede overridear
  return (
    <div className={`grid grid-cols-12 gap-2 items-end rounded-md px-1 py-1 ${aplicaIva ? 'bg-warning/5' : ''}`}>
      <div className="col-span-3 min-w-0">
        {i === 0 && <Label size="sm">Concepto</Label>}
        <ConceptoDescripcionSelector descripcion={c.descripcion} index={i} actualizar={actualizar} />
      </div>
      <div className="col-span-1 min-w-0">
        {i === 0 && <Label size="sm">Unidad</Label>}
        <UnidadMedidaSelect value={c.unidad_medida} onChange={v => actualizar(i, 'unidad_medida', v)} />
      </div>
      <div className="col-span-1 min-w-0">
        {i === 0 && <Label size="sm">Cant.</Label>}
        <Input
          type="text"
          inputMode="decimal"
          {...cantidad}
          placeholder="1"
          aria-label="Cantidad"
        />
      </div>
      <div className="col-span-2 min-w-0">
        {i === 0 && <Label size="sm">P. Unitario (USD)</Label>}
        <Input
          type="text"
          inputMode="decimal"
          {...precio}
          placeholder="0.00"
          aria-label="Precio unitario en dólares"
        />
      </div>
      <div className="col-span-1 min-w-0">
        {i === 0 && <Label size="sm">IVA</Label>}
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
          <span className="text-body-sm text-muted-foreground flex items-center h-10">—</span>
        )}
      </div>
      <div className="col-span-2 min-w-0">
        {i === 0 && <Label size="sm">Total (USD)</Label>}
        <Input value={formatCurrency(c.total, 'USD')} readOnly aria-label="Total en dólares" className="bg-muted tabular-nums" />
      </div>
      <div className="col-span-1">
        {i === 0 && <Label size="sm">&nbsp;</Label>}
        <Button variant="ghost" size="icon" onClick={() => eliminar(i)} disabled={total <= 1} aria-label="Eliminar concepto">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
      <div className="col-span-12 -mt-1 mb-1">
        <Textarea
          value={c.notas || ''}
          onChange={e => actualizar(i, 'notas', e.target.value)}
          placeholder="Notas (opcional)"
          className="h-8 text-body-sm text-muted-foreground resize-none focus:h-16 transition-[height]"
          rows={1}
        />
      </div>
    </div>
  );
}
