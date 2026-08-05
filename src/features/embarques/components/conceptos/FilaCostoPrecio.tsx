/**
 * Fila individual de "Concepto de Costo" del wizard de embarques.
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
import type { ConceptoCostoLocal as ConceptoCostoRow } from "@/types/concepto";

interface Proveedor { id: string; nombre: string }

interface Props {
  costo: ConceptoCostoRow;
  totalUSD: number;
  esMixta: boolean;
  proveedoresDb: Proveedor[];
  cols: string;
  showContenedorCol: boolean;
  embarqueId?: string;
  tcUSD: number;
  tcEUR: number;
  disableRemove: boolean;
  update: (id: number, field: keyof ConceptoCostoRow, value: string | number | boolean | null) => void;
  remove: (id: number) => void;
}

export function FilaCostoPrecio({
  costo, totalUSD, esMixta, proveedoresDb, cols, showContenedorCol,
  embarqueId, tcUSD, tcEUR, disableRemove, update, remove,
}: Props) {
  return (
    <div className={`grid ${cols} gap-2 items-center`}>
      <Select value={costo.proveedorId} onValueChange={v => update(costo.id, 'proveedorId', v)}>
        <SelectTrigger className="text-sm" title={proveedoresDb.find(p => p.id === costo.proveedorId)?.nombre}>
          <SelectValue placeholder="Proveedor" />
        </SelectTrigger>
        <SelectContent>{proveedoresDb.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
      </Select>
      <ConceptoCatalogoSelect
        value={costo.concepto}
        onChange={v => update(costo.id, 'concepto', v)}
      />
      <NumericInput decimals value={costo.monto} onChange={n => update(costo.id, 'monto', n)} className="text-sm h-10" aria-label="Subtotal costo" />
      <Select value={costo.moneda} onValueChange={v => update(costo.id, 'moneda', v)}>
        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
      </Select>
      {showContenedorCol && embarqueId && (
        <SelectContenedorConcepto
          embarqueId={embarqueId}
          value={costo.contenedorId ?? null}
          onChange={v => update(costo.id, 'contenedorId', v)}
          className="text-sm"
        />
      )}
      <div className="flex items-center gap-1">
        <Input
          readOnly
          value={formatCurrency(totalUSD, 'USD')}
          className={`text-sm bg-muted font-semibold ${esMixta ? 'text-warning border-warning/60' : ''}`}
          data-testid={esMixta ? 'fila-mixta-costo' : undefined}
        />
        {esMixta && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" aria-label="Conversión FX aplicada" />
            </TooltipTrigger>
            <TooltipContent>
              Conv. {costo.moneda}→USD @ TC {costo.moneda === 'EUR' ? tcEUR : tcUSD}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(costo.id)} disabled={disableRemove} aria-label="Eliminar costo directo">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
