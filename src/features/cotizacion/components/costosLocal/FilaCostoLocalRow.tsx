import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, PenLine } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { calcularUtilidad, calcularMargen } from "@/lib/financial/financialUtils";
import { ProfitBadge } from "@/components/shared/ProfitBadge";
import { ProductoServicioSelect } from "@/features/cotizacion/components/conceptos/ProductoServicioSelect";
import { UnidadMedidaSelect } from "@/features/cotizacion/components/conceptos/UnidadMedidaSelect";
import { tasaDesdeTipoIva } from "@/features/cotizacion/hooks/useProductosCatalogo";
import type { FilaCostoLocal } from "../SeccionCostosInternosPLUnificado";
import { parseInputNumero, parseCantidad } from "../../utils/parseInputNumero";

/** Valor a mostrar en el input de cantidad: edición en curso, vacío si 0, o el número formateado. */
function getCantidadInputValue(
  editing: { idx: number; raw: string } | null,
  rowIdx: number,
  cantidad: number,
): string {
  if (editing?.idx === rowIdx) return editing.raw;
  if (cantidad === 0) return "";
  return String(cantidad);
}

interface Props {
  fila: FilaCostoLocal;
  gi: number;
  moneda: "USD" | "MXN";
  onUpdate: (globalIdx: number, field: keyof FilaCostoLocal, value: string | number | boolean) => void;
  onRemove: (globalIdx: number) => void;
}

export function FilaCostoLocalRow({ fila, gi, moneda, onUpdate, onRemove }: Props) {
  const [editingQty, setEditingQty] = useState<{ idx: number; raw: string } | null>(null);
  const costoTotal = fila.cantidad * fila.costo_unitario;
  const ventaTotal = fila.cantidad * fila.precio_venta;
  const profit = calcularUtilidad(ventaTotal, costoTotal);
  const pct = calcularMargen(ventaTotal, costoTotal);

  return (
    <div className="border-b border-border last:border-b-0 py-3 px-3 space-y-1">
      <div className="flex items-center gap-2">
        <div className="min-w-[220px] flex-1">
          {/* Combobox estricto contra `catalogo_claves_sat` — mismo origen que el paso 3. */}
          <ProductoServicioSelect
            value={fila.concepto}
            onSelect={(p) => {
              onUpdate(gi, "concepto", p.nombre);
              onUpdate(gi, "clave_sat", p.clave_sat);
              onUpdate(gi, "concepto_libre", false);
              onUpdate(gi, "aplica_iva", p.tipo_iva === "gravado_16");
              onUpdate(gi, "tasa_iva_aplicada", tasaDesdeTipoIva(p.tipo_iva));
              // Sólo pre-llena unidad si la fila no tenía una elegida a mano.
              if (p.clave_unidad_sat && !fila.unidad_medida) {
                onUpdate(gi, "unidad_medida", p.clave_unidad_sat);
              }
            }}
            onConceptoLibre={(texto) => {
              // Q-10/Q-12: concepto sin clave SAT — se marca `concepto_libre`
              // para que la fila sea válida sin bloquear el wizard; la clave
              // SAT se pedirá manualmente en el paso de facturación.
              onUpdate(gi, "concepto", texto);
              onUpdate(gi, "clave_sat", "");
              onUpdate(gi, "concepto_libre", true);
            }}
            placeholder="Selecciona concepto"
          />
          {fila.concepto_libre && (
            <p
              className="mt-0.5 flex items-center gap-1 text-2xs text-warning"
              data-testid={`concepto-libre-aviso-${gi}`}
            >
              <PenLine className="h-3 w-3" /> Concepto libre: se pedirá la clave SAT al facturar.
            </p>
          )}
        </div>
        <Input value={fila.proveedor} onChange={e => onUpdate(gi, "proveedor", e.target.value)} className="h-9 text-sm w-[120px]" placeholder="Proveedor" />
        <div className="w-[130px]">
          <UnidadMedidaSelect
            value={fila.unidad_medida}
            onChange={(v) => onUpdate(gi, "unidad_medida", v)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Cant.</span>
          <Input
            type="text" inputMode="decimal"
            value={getCantidadInputValue(editingQty, gi, fila.cantidad)}
            onFocus={e => {
              const val = fila.cantidad === 0 ? '' : String(fila.cantidad);
              setEditingQty({ idx: gi, raw: val });
              if (e.target.value === '0') e.target.value = '';
            }}
            onChange={e => {
              const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
              setEditingQty({ idx: gi, raw });
              onUpdate(gi, "cantidad", parseCantidad(raw));
            }}
            onBlur={() => { setEditingQty(null); if (fila.cantidad === 0 || isNaN(fila.cantidad)) onUpdate(gi, "cantidad", 1); }}
            className="h-8 text-sm text-right w-[80px]"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Costo</span>
          <Input type="text" inputMode="decimal" value={fila.costo_unitario === 0 ? '' : fila.costo_unitario}
            onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
            onChange={e => { const raw = e.target.value.replace(/[^0-9.]/g, ''); onUpdate(gi, "costo_unitario", parseInputNumero(raw)); }}
            onBlur={e => { if (e.target.value === '') onUpdate(gi, "costo_unitario", 0); }}
            className="h-8 text-sm text-right w-[110px]"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Venta</span>
          <Input type="text" inputMode="decimal" value={fila.precio_venta === 0 ? '' : fila.precio_venta}
            onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
            onChange={e => { const raw = e.target.value.replace(/[^0-9.]/g, ''); onUpdate(gi, "precio_venta", parseInputNumero(raw)); }}
            onBlur={e => { if (e.target.value === '') onUpdate(gi, "precio_venta", 0); }}
            className="h-8 text-sm text-right w-[110px]"
          />
        </div>
        {/* Q-15.9 — totales visibles por partida: el multiplicador queda explícito. */}
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {fila.cantidad} × costo = {formatCurrency(costoTotal, moneda)} · venta {formatCurrency(ventaTotal, moneda)}
        </span>
        <span className={`text-sm font-medium w-[100px] text-right ${profit >= 0 ? "text-success" : "text-destructive"}`}>
          {formatCurrency(profit, moneda)}
        </span>
        <div className="w-[70px] flex justify-center"><ProfitBadge porcentaje={pct} /></div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRemove(gi)} aria-label="Eliminar grupo">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <Textarea
        placeholder="Notas (opcional)"
        value={fila.notas || ""}
        onChange={e => onUpdate(gi, "notas", e.target.value)}
        className="mt-1 text-xs h-8 min-h-[32px] resize-none focus:min-h-[60px] transition-all"
      />
    </div>
  );
}
