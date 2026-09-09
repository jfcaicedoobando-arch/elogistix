import { memo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks";
import { formatCurrency } from "@/lib/formatters";
import { calcularIVA, resolverTasaConcepto, TASAS_IVA_MX } from "@/lib/financial/financialUtils";
import { UnidadMedidaSelect } from "./UnidadMedidaSelect";
import { ConceptoDescripcionSelector } from "./ConceptoDescripcionSelector";
import { useNumericField } from "@/features/cotizacion/hooks/useNumericField";
import { parseCantidad } from "@/features/cotizacion/utils/parseInputNumero";

interface ConceptoRowMXNProps {
  concepto: ConceptoVentaCotizacion;
  index: number;
  total: number;
  actualizar: (index: number, campo: string, valor: string | number | boolean) => void;
  eliminar: (index: number) => void;
  tasaIva: number;
}

/**
 * VIS-CE-251-07 (R257-01/02): Cant./P. Unitario se capturan con
 * `useNumericField` (texto crudo con foco, confirmación en blur) para que
 * `1.5` no se convierta en `15`. La tasa de IVA por línea se resuelve con
 * `resolverTasaConcepto` y se escribe UNA sola vez (`tasa_iva_aplicada`): el
 * hook deriva `aplica_iva`, así elegir 8% ya no lo reemplaza la tasa general.
 */
export const ConceptoRowMXN = memo(function ConceptoRowMXN({
  concepto: c, index: i, total, actualizar, eliminar, tasaIva,
}: ConceptoRowMXNProps) {
  const cantidad = useNumericField(c.cantidad, (n) => actualizar(i, "cantidad", n), { parse: parseCantidad, fallback: 1 });
  const precio = useNumericField(c.precio_unitario, (n) => actualizar(i, "precio_unitario", n));
  const subtotal = c.cantidad * c.precio_unitario;
  const tasaFila = resolverTasaConcepto(c, tasaIva);
  const iva = calcularIVA(subtotal, tasaFila);

  return (
    <div className={`grid grid-cols-12 gap-2 items-end rounded-md px-1 py-1 ${tasaFila > 0 ? 'bg-warning/5' : ''}`}>
      <div className="col-span-4 min-w-0">
        {i === 0 && <Label size="sm">Concepto</Label>}
        <ConceptoDescripcionSelector descripcion={c.descripcion} index={i} actualizar={actualizar} />
      </div>
      <div className="col-span-2 min-w-0">
        {i === 0 && <Label size="sm">Unidad</Label>}
        <UnidadMedidaSelect value={c.unidad_medida} onChange={(v) => actualizar(i, 'unidad_medida', v)} />
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
        {i === 0 && <Label size="sm">P. Unitario (MXN)</Label>}
        <Input
          type="text"
          inputMode="decimal"
          {...precio}
          placeholder="0.00"
          aria-label="Precio unitario"
        />
      </div>
      <div className="col-span-2 min-w-0">
        {i === 0 && <Label size="sm">Tasa IVA</Label>}
        <Select
          value={String(tasaFila)}
          onValueChange={(v) => actualizar(i, 'tasa_iva_aplicada', Number(v))}
        >
          <SelectTrigger className="h-10" aria-label="Tasa de IVA"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TASAS_IVA_MX.map(opt => (
              <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-1">
        {i === 0 && <Label size="sm">&nbsp;</Label>}
        <Button variant="ghost" size="icon" onClick={() => eliminar(i)} disabled={total <= 1} aria-label="Eliminar concepto">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
      <div className="col-span-12 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="min-w-0">
          <Label size="sm">Subtotal</Label>
          <Input value={formatCurrency(subtotal, 'MXN')} readOnly aria-label="Subtotal" className="bg-muted tabular-nums" />
        </div>
        <div className="min-w-0">
          <Label size="sm">IVA</Label>
          <Input value={formatCurrency(iva, 'MXN')} readOnly aria-label="IVA" className="bg-muted tabular-nums" />
        </div>
        <div className="min-w-0">
          <Label size="sm">Total</Label>
          <Input value={formatCurrency(c.total, 'MXN')} readOnly aria-label="Total" className="bg-muted tabular-nums" />
        </div>
      </div>
      <div className="col-span-12 -mt-1 mb-1">
        <Textarea
          value={c.notas ?? ''}
          onChange={(e) => actualizar(i, "notas", e.target.value)}
          placeholder="Notas (opcional)"
          className="h-8 text-body-sm text-muted-foreground resize-none focus:h-16 transition-[height]"
          rows={1}
        />
      </div>
    </div>
  );
});
