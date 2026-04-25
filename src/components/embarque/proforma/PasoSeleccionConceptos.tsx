import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import type { Tables } from "@/integrations/supabase/types";

type ConceptoVenta = Tables<"conceptos_venta">;

export interface TotalesProforma {
  subtotal_usd: number;
  iva_usd: number;
  total_usd: number;
  subtotal_mxn: number;
  iva_mxn: number;
  total_mxn: number;
}

interface Props {
  conceptosPendientes: ConceptoVenta[];
  seleccionados: Set<string>;
  ivaPorConcepto: Record<string, boolean>;
  totales: TotalesProforma;
  tasaIva: number;
  notas: string;
  diasCredito: string;
  operadorEmbarque: string | null;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onToggleIva: (id: string, moneda: string) => void;
  onNotasChange: (v: string) => void;
  onDiasCreditoChange: (v: string) => void;
}

export function PasoSeleccionConceptos({
  conceptosPendientes, seleccionados, ivaPorConcepto, totales, tasaIva,
  notas, diasCredito, operadorEmbarque,
  onToggle, onToggleAll, onToggleIva, onNotasChange, onDiasCreditoChange,
}: Props) {
  const totalSeleccionados = seleccionados.size;
  const allSelected = totalSeleccionados === conceptosPendientes.length && totalSeleccionados > 0;

  return (
    <div className="space-y-4">
      <div className="border rounded-md">
        <div className="flex items-center justify-between p-3 bg-muted/50 border-b">
          <div className="flex items-center gap-2">
            <Checkbox checked={allSelected} onCheckedChange={onToggleAll} id="all" />
            <Label htmlFor="all" className="text-sm font-medium cursor-pointer">
              Seleccionar todos ({totalSeleccionados}/{conceptosPendientes.length})
            </Label>
          </div>
          <span className="text-xs text-muted-foreground">IVA por concepto</span>
        </div>
        <div className="divide-y max-h-[300px] overflow-y-auto">
          {conceptosPendientes.map(c => {
            const sub = Number(c.cantidad) * Number(c.precio_unitario);
            const isSelected = seleccionados.has(c.id);
            const ivaActivo = ivaPorConcepto[c.id] ?? false;
            const ivaBloqueado = c.moneda === "MXN";
            return (
              <div key={c.id} className="flex items-start gap-3 p-3 hover:bg-muted/30">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggle(c.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{c.descripcion}</span>
                    <Badge variant="outline" className="text-xs">{c.moneda}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {c.cantidad} × {formatCurrency(Number(c.precio_unitario), c.moneda)} = {formatCurrency(sub, c.moneda)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`iva-${c.id}`} className="text-xs text-muted-foreground cursor-pointer">
                      IVA
                    </Label>
                    <Switch
                      id={`iva-${c.id}`}
                      checked={ivaActivo}
                      onCheckedChange={() => onToggleIva(c.id, c.moneda)}
                      disabled={ivaBloqueado || !isSelected}
                    />
                  </div>
                  {ivaBloqueado && (
                    <span className="text-[10px] text-muted-foreground">Obligatorio MXN</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
        <h4 className="font-semibold text-sm mb-2">Totales de la Proforma</h4>
        {totales.subtotal_usd > 0 && (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal USD:</span><span>{formatCurrency(totales.subtotal_usd, "USD")}</span></div>
            {totales.iva_usd > 0 && (
              <div className="flex justify-between text-muted-foreground"><span>IVA USD:</span><span>{formatCurrency(totales.iva_usd, "USD")}</span></div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total USD:</span><span>{formatCurrency(totales.total_usd, "USD")}</span></div>
          </div>
        )}
        {totales.subtotal_mxn > 0 && (
          <div className={`space-y-1 text-sm ${totales.subtotal_usd > 0 ? "mt-3 pt-3 border-t" : ""}`}>
            <div className="flex justify-between"><span>Subtotal MXN:</span><span>{formatCurrency(totales.subtotal_mxn, "MXN")}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>IVA ({(tasaIva * 100).toFixed(0)}%) MXN:</span><span>{formatCurrency(totales.iva_mxn, "MXN")}</span></div>
            <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total MXN:</span><span>{formatCurrency(totales.total_mxn, "MXN")}</span></div>
          </div>
        )}
        {totalSeleccionados === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">Selecciona al menos un concepto</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="dias-credito" className="text-sm">Días de crédito</Label>
          <Input
            id="dias-credito"
            type="number"
            min={0}
            value={diasCredito}
            onChange={(e) => onDiasCreditoChange(e.target.value)}
            placeholder="0 = Contado"
            className="mt-1"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Por defecto se toma del cliente. 0 = Contado.
          </p>
        </div>
        <div>
          <Label className="text-sm">Ejecutivo de Operaciones</Label>
          <div className="mt-1 px-3 py-2 rounded-md border bg-muted/30 text-sm">
            {operadorEmbarque || <span className="text-muted-foreground italic">Sin asignar</span>}
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="notas" className="text-sm">Notas (opcional)</Label>
        <Textarea
          id="notas"
          value={notas}
          onChange={(e) => onNotasChange(e.target.value)}
          placeholder="Notas adicionales para esta proforma..."
          rows={2}
          className="mt-1"
        />
      </div>
    </div>
  );
}
