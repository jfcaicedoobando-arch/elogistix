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
  tcEUR: number;
  disableRemove: boolean;
  update: (id: number, field: keyof ConceptoVentaRow, value: string | number | boolean | null) => void;
  remove: (id: number) => void;
}

export function FilaVentaPrecio({
  venta, totalUSD, esMixta, cols, showContenedorCol,
  embarqueId, tcUSD, tcEUR, disableRemove, update, remove,
}: Props) {
  return (
    <div className={`grid ${cols} gap-2 items-center`}>
      <Select value={venta.concepto} onValueChange={v => update(venta.id, 'concepto', v)}>
        <SelectTrigger className="text-sm"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
        <SelectContent>{CATALOGO_CONCEPTOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
      </Select>
      <NumericInput value={venta.cantidad} onChange={n => update(venta.id, 'cantidad', n)} className="text-sm h-10" aria-label="Cantidad venta" />
      <NumericInput decimals value={venta.precioUnitario} onChange={n => update(venta.id, 'precioUnitario', n)} className="text-sm h-10" aria-label="Subtotal venta" />
      <Select value={venta.moneda} onValueChange={v => update(venta.id, 'moneda', v)}>
        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
      </Select>
      {showContenedorCol && embarqueId && (
        <SelectContenedorConcepto
          embarqueId={embarqueId}
          value={venta.contenedorId ?? null}
          onChange={v => update(venta.id, 'contenedorId', v)}
          className="text-sm"
        />
      )}
      <div className="flex items-center gap-1">
        <Input
          readOnly
          value={formatCurrency(totalUSD, 'USD')}
          className={`text-sm bg-muted font-semibold ${esMixta ? 'text-warning border-warning/60' : ''}`}
          data-testid={esMixta ? 'fila-mixta-venta' : undefined}
        />
        {esMixta && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" aria-label="Conversión FX aplicada" />
            </TooltipTrigger>
            <TooltipContent>
              Conv. {venta.moneda}→USD @ TC {venta.moneda === 'EUR' ? tcEUR : tcUSD}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(venta.id)} disabled={disableRemove} aria-label="Eliminar concepto de venta">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
