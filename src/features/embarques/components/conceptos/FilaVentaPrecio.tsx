/**
 * Fila individual de "Concepto de Venta" del wizard de embarques.
 * Extraída de `StepCostosPrecios.tsx` en 12.61.18 (Sprint 2.1, Power-of-10 #1).
 */
import { AlertTriangle, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NumericInput } from "@/components/shared/NumericInput";
import { SelectContenedorConcepto } from "@/features/embarques/components/conceptos/SelectContenedorConcepto";
import { ConceptoCatalogoSelect } from "@/features/embarques/components/conceptos/ConceptoCatalogoSelect";
import type { ConceptoVentaLocal as ConceptoVentaRow } from "@/types/concepto";

interface Props {
  venta: ConceptoVentaRow;
  totalUSD: number;
  esMixta: boolean;
  cols: string;
  showContenedorCol: boolean;
  embarqueId?: string;
  tcUSD: number;
  disableRemove: boolean;
  update: (id: number, field: keyof ConceptoVentaRow, value: string | number | boolean | null) => void;
  remove: (id: number) => void;
}

export function FilaVentaPrecio({
  venta, totalUSD, esMixta, cols, showContenedorCol,
  embarqueId, tcUSD, disableRemove, update, remove,
}: Props) {
  return (
    <div className={`grid ${cols} gap-2 items-center`}>
      <ConceptoCatalogoSelect
        value={venta.concepto}
        onChange={v => update(venta.id, 'concepto', v)}
      />
      <NumericInput value={venta.cantidad} onChange={n => update(venta.id, 'cantidad', n)} className="text-body h-10" aria-label="Cantidad venta" />
      <NumericInput decimals value={venta.precioUnitario} onChange={n => update(venta.id, 'precioUnitario', n)} className="text-body h-10" aria-label="Subtotal venta" />
      <Select value={venta.moneda} onValueChange={v => update(venta.id, 'moneda', v)}>
        <SelectTrigger className="text-body"><SelectValue /></SelectTrigger>
        {/* Ola 2 · A (YAGNI): la venta sólo se factura en MXN o USD. EUR sigue
            disponible en costos/CxP, pero aquí terminaba facturándose en $0. */}
        <SelectContent><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
      </Select>
      {showContenedorCol && embarqueId && (
        <SelectContenedorConcepto
          embarqueId={embarqueId}
          value={venta.contenedorId ?? null}
          onChange={v => update(venta.id, 'contenedorId', v)}
          className="text-body"
        />
      )}
      <div className="flex items-center gap-1">
        <Input
          readOnly
          aria-label="Total en USD de la venta"
          value={formatCurrency(totalUSD, 'USD')}
          className={`text-body bg-muted font-semibold ${esMixta ? 'text-warning border-warning/60' : ''}`}
          data-testid={esMixta ? 'fila-mixta-venta' : undefined}
        />
        {esMixta && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" aria-label="Conversión FX aplicada" />
            </TooltipTrigger>
            <TooltipContent>
              Conv. {venta.moneda}→USD @ TC {tcUSD}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11 md:h-8 md:w-8 md:min-h-0 md:min-w-0" onClick={() => remove(venta.id)} disabled={disableRemove} aria-label="Eliminar concepto de venta">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
