import { memo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Trash2, StickyNote } from "lucide-react";

import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { calcularIVA, resolverTasaConcepto, TASAS_IVA_MX } from "@/lib/financial/financialUtils";
import { UnidadMedidaSelect } from "./UnidadMedidaSelect";
import { ConceptoDescripcionSelector } from "./ConceptoDescripcionSelector";
import { CONCEPTO_GRID_MXN, CONCEPTO_SOLO_XL } from "./columnasConcepto";
import { useNumericField } from "@/features/cotizacion/hooks/useNumericField";
import { parseCantidad } from "@/features/cotizacion/utils/parseInputNumero";
import { cn } from "@/lib/utils";

interface ConceptoRowMXNProps {
  concepto: ConceptoVentaCotizacion;
  index: number;
  total: number;
  actualizar: (index: number, campo: string, valor: string | number | boolean) => void;
  eliminar: (index: number) => void;
  tasaIva: number;
}

/** Formato de presentación del campo de dinero (sin prefijo de moneda). */
const formatoMonto = (n: number) => formatNumber(n, { decimals: 2 });

/**
 * VIS-CE-251-07 (R257-01/02): Cant./P. Unitario se capturan con
 * `useNumericField` (texto crudo con foco, confirmación en blur) para que
 * `1.5` no se convierta en `15`. La tasa de IVA por línea se resuelve con
 * `resolverTasaConcepto` y se escribe UNA sola vez (`tasa_iva_aplicada`): el
 * hook deriva `aplica_iva`, así elegir 8% ya no lo reemplaza la tasa general.
 *
 * v13.823.286: el renglón adopta la MISMA estructura de una línea que el de
 * USD. Subtotal e IVA son columnas calculadas y sólo se muestran desde `xl`
 * (en pantallas medianas se leen en el pie de la sección), igual que el paso 2.
 */
export const ConceptoRowMXN = memo(function ConceptoRowMXN({
  concepto: c, index: i, total, actualizar, eliminar, tasaIva,
}: ConceptoRowMXNProps) {
  const cantidad = useNumericField(c.cantidad, (n) => actualizar(i, "cantidad", n), { parse: parseCantidad, fallback: 1 });
  const precio = useNumericField(c.precio_unitario, (n) => actualizar(i, "precio_unitario", n), {
    formatDisplay: formatoMonto,
  });
  const subtotal = c.cantidad * c.precio_unitario;
  const tasaFila = resolverTasaConcepto(c, tasaIva);
  const iva = calcularIVA(subtotal, tasaFila);
  // Notas a demanda (mismo patrón que el paso 2): la lista deja de ser altísima.
  const [notasAbiertas, setNotasAbiertas] = useState(false);
  // Cerradas por defecto: el icono resaltado indica que hay nota guardada.
  const mostrarNotas = notasAbiertas;

  return (
    <div className={cn("rounded-md px-1 py-1", tasaFila > 0 && "bg-warning/5")}>
      <div className={CONCEPTO_GRID_MXN}>
        <div className="min-w-0">
          {i === 0 && <Label size="sm">Concepto</Label>}
          <ConceptoDescripcionSelector descripcion={c.descripcion} index={i} actualizar={actualizar} />
        </div>
        <div className="min-w-0">
          {i === 0 && <Label size="sm">Unidad</Label>}
          <UnidadMedidaSelect value={c.unidad_medida} onChange={(v) => actualizar(i, 'unidad_medida', v)} />
        </div>
        <div className="min-w-0">
          {i === 0 && <Label size="sm">Cant.</Label>}
          <Input
            type="text"
            inputMode="decimal"
            {...cantidad}
            placeholder="1"
            aria-label="Cantidad"
            className="text-right tabular-nums"
          />
        </div>
        <div className="min-w-0">
          {i === 0 && <Label size="sm">Venta unit.</Label>}
          <Input
            type="text"
            inputMode="decimal"
            {...precio}
            placeholder="0.00"
            aria-label="Precio unitario"
            className="text-right tabular-nums"
          />
        </div>
        <div className="min-w-0">
          {i === 0 && <Label size="sm">Tasa IVA</Label>}
          <Select
            value={String(tasaFila)}
            onValueChange={(v) => actualizar(i, 'tasa_iva_aplicada', Number(v))}
          >
            {/* Sólo el porcentaje: la etiqueta larga ("16% — Tasa general") se
                cortaba a "16% —…" en la columna. La descripción sigue visible
                al abrir la lista. */}
            <SelectTrigger className="h-10" aria-label="Tasa de IVA">{Math.round(tasaFila * 100)}%</SelectTrigger>
            <SelectContent>
              {TASAS_IVA_MX.map(opt => (
                <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className={CONCEPTO_SOLO_XL}>
          {i === 0 && <Label size="sm">Subtotal</Label>}
          <Input value={formatCurrency(subtotal, 'MXN')} readOnly aria-label="Subtotal" className="bg-muted tabular-nums text-right" />
        </div>
        <div className={CONCEPTO_SOLO_XL}>
          {i === 0 && <Label size="sm">IVA</Label>}
          <Input value={formatCurrency(iva, 'MXN')} readOnly aria-label="IVA" className="bg-muted tabular-nums text-right" />
        </div>
        <div className="min-w-0">
          {i === 0 && <Label size="sm">Venta total</Label>}
          <Input value={formatCurrency(c.total, 'MXN')} readOnly aria-label="Total" className="bg-muted tabular-nums text-right" />
        </div>
        <div className="flex items-center justify-end gap-1">
          {i === 0 && <Label size="sm">&nbsp;</Label>}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            aria-label={mostrarNotas ? "Ocultar notas" : "Agregar notas"}
            aria-expanded={mostrarNotas}
            onClick={() => setNotasAbiertas((v) => !v)}
          >
            <StickyNote className={`size-4 ${c.notas ? "text-primary" : "text-muted-foreground"}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => eliminar(i)} disabled={total <= 1} aria-label="Eliminar concepto">
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>
      {mostrarNotas && (
        <Textarea
          value={c.notas ?? ''}
          onChange={(e) => actualizar(i, "notas", e.target.value)}
          placeholder="Notas (opcional)"
          aria-label="Notas del concepto"
          className="mt-2 min-h-9 h-9 py-2 text-body-sm resize-y"
          rows={1}
        />
      )}
    </div>
  );
});
