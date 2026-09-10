import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Trash2, StickyNote } from "lucide-react";

import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { TASAS_IVA_MX, resolverTasaConcepto } from "@/lib/financial/financialUtils";

import { UnidadMedidaSelect } from "./UnidadMedidaSelect";
import { ConceptoDescripcionSelector } from "./ConceptoDescripcionSelector";
import { CONCEPTO_GRID_USD } from "./columnasConcepto";
import { useNumericField } from "@/features/cotizacion/hooks/useNumericField";
import { parseCantidad } from "@/features/cotizacion/utils/parseInputNumero";
import { cn } from "@/lib/utils";

export interface ConceptoRowProps {
  concepto: ConceptoVentaCotizacion;
  index: number;
  total: number;
  actualizar: (index: number, campo: string, valor: string | number | boolean) => void;
  eliminar: (index: number) => void;
}

/** Formato de presentación del campo de dinero (sin prefijo de moneda). */
const formatoMonto = (n: number) => formatNumber(n, { decimals: 2 });

/**
 * VIS-CE-251-07 (R257-01/02): la captura de Cant./P. Unitario usa
 * `useNumericField` (texto crudo mientras hay foco, confirmación en blur), así
 * `1.5` ya no se convierte en `15`. La selección de catálogo sigue en
 * `ConceptoDescripcionSelector` y la tasa de IVA se escribe UNA sola vez
 * (`tasa_iva_aplicada`) para que el hook no la pise con la tasa general.
 *
 * v13.823.286: columnas con anchos explícitos compartidos con el renglón MXN
 * (`CONCEPTO_GRID_USD`) para que Unidad e IVA dejen de truncarse, y el precio
 * unitario se lee con formato de dinero al salir del campo.
 */
export function ConceptoRowUSD({ concepto: c, index: i, total, actualizar, eliminar }: ConceptoRowProps) {
  const cantidad = useNumericField(c.cantidad, (n) => actualizar(i, "cantidad", n), { parse: parseCantidad, fallback: 1 });
  const precio = useNumericField(c.precio_unitario, (n) => actualizar(i, "precio_unitario", n), {
    formatDisplay: formatoMonto,
  });
  const tasaFila = resolverTasaConcepto(c, 0);
  const aplicaIva = tasaFila > 0;
  const puedeIva = !!c.descripcion; // el catálogo determina si es gravado; usuario puede overridear
  // Las notas se abren a demanda (igual que en el paso 2): antes cada renglón
  // llevaba un cuadro de notas abierto y la lista quedaba altísima.
  const [notasAbiertas, setNotasAbiertas] = useState(false);
  // Cerradas por defecto: el icono resaltado indica que hay nota guardada.
  const mostrarNotas = notasAbiertas;
  return (
    <div className={cn("rounded-md px-1 py-1", aplicaIva && "bg-warning/5")}>
      <div className={CONCEPTO_GRID_USD}>
        <div className="min-w-0">
          {i === 0 && <Label size="sm">Concepto</Label>}
          <ConceptoDescripcionSelector descripcion={c.descripcion} index={i} actualizar={actualizar} />
        </div>
        <div className="min-w-0">
          {i === 0 && <Label size="sm">Unidad</Label>}
          <UnidadMedidaSelect value={c.unidad_medida} onChange={v => actualizar(i, 'unidad_medida', v)} />
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
            aria-label="Precio unitario en dólares"
            className="text-right tabular-nums"
          />
        </div>
        <div className="min-w-0">
          {i === 0 && <Label size="sm">IVA</Label>}
          {puedeIva ? (
            <Select
              value={String(tasaFila)}
              onValueChange={(v) => actualizar(i, 'tasa_iva_aplicada', Number(v))}
            >
              {/* Sólo el porcentaje: la etiqueta larga se cortaba en la columna. */}
              <SelectTrigger className="h-10" aria-label="Tasa de IVA">{Math.round(tasaFila * 100)}%</SelectTrigger>
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
        <div className="min-w-0">
          {i === 0 && <Label size="sm">Venta total</Label>}
          <Input value={formatCurrency(c.total, 'USD')} readOnly aria-label="Total en dólares" className="bg-muted tabular-nums text-right" />
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
          value={c.notas || ''}
          onChange={e => actualizar(i, 'notas', e.target.value)}
          placeholder="Notas (opcional)"
          aria-label="Notas del concepto"
          className="mt-2 min-h-9 h-9 py-2 text-body-sm resize-y"
          rows={1}
        />
      )}
    </div>
  );
}
