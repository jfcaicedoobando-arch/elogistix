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
import { costoBloqueado, MOTIVO_COSTO_BLOQUEADO } from "@/features/embarques/domain/conceptoBloqueado";

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

/** Select de proveedor del renglón. Extraído para acotar la complejidad. */
function SelectProveedorCosto({
  costo, proveedoresDb, bloqueado, onChange,
}: {
  costo: ConceptoCostoRow;
  proveedoresDb: Proveedor[];
  bloqueado: boolean;
  onChange: (id: string) => void;
}) {
  const nombreCatalogo = proveedoresDb.find(p => p.id === costo.proveedorId)?.nombre;
  const heredado = costo.proveedorNombre?.trim() ?? '';
  const sinCatalogo = !costo.proveedorId && heredado !== '';
  return (
    <Select value={costo.proveedorId} disabled={bloqueado} onValueChange={onChange}>
      <SelectTrigger
        className={`text-body ${sinCatalogo ? 'border-warning/60' : ''}`}
        title={nombreCatalogo ?? heredado ?? undefined}
      >
        {/* v13.509.0 — Si el costo viene de cotización sólo con nombre, lo
            mostramos como texto para que el operador lo confirme en vez de
            ver el campo vacío. */}
        <SelectValue placeholder={heredado || "Proveedor"} />
      </SelectTrigger>
      <SelectContent>{proveedoresDb.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
    </Select>
  );
}

export function FilaCostoPrecio({
  costo, totalUSD, esMixta, proveedoresDb, cols, showContenedorCol,
  embarqueId, tcUSD, tcEUR, disableRemove, update, remove,
}: Props) {
  // Un costo ya pagado no es actualizable por la RPC de guardado.
  const bloqueado = costoBloqueado(costo.estadoLiquidacion);
  return (
    <div className={`grid ${cols} gap-2 items-center`} title={bloqueado ? MOTIVO_COSTO_BLOQUEADO : undefined}>
      <SelectProveedorCosto
        costo={costo}
        proveedoresDb={proveedoresDb}
        bloqueado={bloqueado}
        onChange={v => update(costo.id, 'proveedorId', v)}
      />

      <ConceptoCatalogoSelect
        value={costo.concepto}
        disabled={bloqueado}
        onChange={v => update(costo.id, 'concepto', v)}
      />
      <NumericInput decimals value={costo.monto} disabled={bloqueado} onChange={n => update(costo.id, 'monto', n)} className="text-body h-10" aria-label="Subtotal costo" />
      <Select value={costo.moneda} disabled={bloqueado} onValueChange={v => update(costo.id, 'moneda', v)}>
        <SelectTrigger className="text-body"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent>
      </Select>
      {showContenedorCol && embarqueId && (
        <SelectContenedorConcepto
          embarqueId={embarqueId}
          value={costo.contenedorId ?? null}
          disabled={bloqueado}
          onChange={v => update(costo.id, 'contenedorId', v)}
          className="text-body"
        />
      )}
      <div className="flex items-center gap-1">
        <Input
          readOnly
          aria-label="Total en USD del costo"
          value={formatCurrency(totalUSD, 'USD')}
          className={`text-body bg-muted font-semibold ${esMixta ? 'text-warning border-warning/60' : ''}`}
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
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11 md:h-8 md:w-8 md:min-h-0 md:min-w-0" onClick={() => remove(costo.id)} disabled={disableRemove || bloqueado} aria-label="Eliminar costo directo">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
