import { memo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks";
import { formatCurrency } from "@/lib/formatters";
import { calcularIVA, resolverTasaConcepto } from "@/lib/financial/financialUtils";
import { ProductoServicioSelect } from "./ProductoServicioSelect";
import { UnidadMedidaSelect } from "./UnidadMedidaSelect";
import { tasaDesdeTipoIva } from "@/features/cotizacion/hooks/useProductosCatalogo";
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
 * VIS-CE-251-07: cantidad/precio se capturan con texto crudo
 * (`useNumericField`) y se confirman al salir del campo — `1.5` ya no se
 * convierte en `15` por el parseInt anterior.
 * VIS-CE-251-01: la fila usa flex-wrap con anchos mínimos para que Subtotal,
 * IVA y Total quepan completos en 1280x720; si el ancho no alcanza, los
 * importes bajan a una segunda línea en lugar de truncarse.
 */
export const ConceptoRowMXN = memo(function ConceptoRowMXN({
  concepto: c, index: i, total, actualizar, eliminar, tasaIva,
}: ConceptoRowMXNProps) {
  const cantidad = useNumericField(c.cantidad, (n) => actualizar(i, "cantidad", n), { parse: parseCantidad, fallback: 1 });
  const precio = useNumericField(c.precio_unitario, (n) => actualizar(i, "precio_unitario", n), { parse: parsePrecio });
  const subtotal = c.cantidad * c.precio_unitario;
  const iva = c.aplica_iva ? calcularIVA(subtotal, tasaIva) : 0;
  const totalFila = subtotal + iva;

  return (
    <div className="p-3 bg-muted/30 rounded-md border space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px] space-y-1">
          {i === 0 && <Label className="text-caption">Concepto</Label>}
          <ProductoServicioSelect
            value={c.concepto}
            onChange={(v) => actualizar(i, "concepto", v)}
            onPickConcepto={(picked) => {
              if (picked.unidad_medida) actualizar(i, "unidad_medida", picked.unidad_medida);
              if (typeof picked.aplica_iva === "boolean") actualizar(i, "aplica_iva", picked.aplica_iva);
              if (typeof picked.tasa_iva_aplicada === "number") actualizar(i, "tasa_iva_aplicada", picked.tasa_iva_aplicada);
            }}
          />
        </div>
        <div className="w-[110px] space-y-1">
          {i === 0 && <Label className="text-caption">Unidad</Label>}
          <UnidadMedidaSelect value={c.unidad_medida ?? ''} onChange={(v) => actualizar(i, 'unidad_medida', v)} />
        </div>
        <div className="w-[76px] space-y-1">
          {i === 0 && <Label className="text-caption">Cantidad</Label>}
          <Input
            type="text"
            inputMode="decimal"
            {...cantidad}
            placeholder="1"
            aria-label="Cantidad"
          />
        </div>
        <div className="w-[120px] space-y-1">
          {i === 0 && <Label className="text-caption">P. Unit</Label>}
          <Input
            type="text"
            inputMode="decimal"
            {...precio}
            placeholder="0.00"
            aria-label="Precio unitario"
          />
        </div>
        <div className="w-[128px] space-y-1">
          {i === 0 && <Label className="text-caption">Subtotal</Label>}
          <div className="text-body-sm font-medium py-2 tabular-nums whitespace-nowrap">{formatCurrency(subtotal, 'MXN')}</div>
        </div>
        <div className="w-[110px] space-y-1">
          {i === 0 && <Label className="text-caption">Tasa IVA</Label>}
          <Select
            value={(c.tasa_iva_aplicada ?? (c.aplica_iva ? tasaIva : 0)).toString()}
            onValueChange={(v) => {
              const tasa = parseFloat(v);
              actualizar(i, "tasa_iva_aplicada", tasa);
              actualizar(i, "aplica_iva", tasa > 0);
            }}
          >
            <SelectTrigger className="h-9" aria-label="Tasa de IVA"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={tasaIva.toString()}>{(tasaIva * 100).toFixed(0)}%</SelectItem>
              <SelectItem value="0.08">8%</SelectItem>
              <SelectItem value="0">0% / Exento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[128px] space-y-1">
          {i === 0 && <Label className="text-caption">IVA</Label>}
          <div className="text-body-sm font-medium py-2 tabular-nums whitespace-nowrap">{formatCurrency(iva, 'MXN')}</div>
        </div>
        <div className="w-[132px] space-y-1">
          {i === 0 && <Label className="text-caption">Total</Label>}
          <div className="text-body-sm font-semibold py-2 tabular-nums whitespace-nowrap">{formatCurrency(totalFila, 'MXN')}</div>
        </div>
        <div className="shrink-0 space-y-1">
          {i === 0 && <div className="h-4" aria-hidden="true" />}
          <Button variant="ghost" size="sm" onClick={() => eliminar(i)} disabled={total === 1} aria-label="Eliminar concepto">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Input
        value={c.notas ?? ''}
        onChange={(e) => actualizar(i, "notas", e.target.value)}
        placeholder="Notas (opcional)"
        className="text-body-sm"
        aria-label="Notas del concepto"
      />
    </div>
  );
});
