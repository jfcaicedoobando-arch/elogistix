import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, PenLine } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { calcularUtilidad, calcularMargen } from "@/lib/financial/financialUtils";
import { ProfitBadge } from "@/components/shared/ProfitBadge";
import { ProductoServicioSelect } from "@/features/cotizacion/components/conceptos/ProductoServicioSelect";
import { UnidadMedidaSelect } from "@/features/cotizacion/components/conceptos/UnidadMedidaSelect";
import { tasaDesdeTipoIva } from "@/features/cotizacion/hooks/useProductosCatalogo";
import type { FilaCostoLocal } from "../SeccionCostosInternosPLUnificado";
import { parseCantidad, cantidadFueraDeRango, CANTIDAD_LIMITE_SANIDAD } from "../../utils/parseInputNumero";
import { useNumericField } from "@/features/cotizacion/hooks/useNumericField";

interface Props {
  fila: FilaCostoLocal;
  gi: number;
  moneda: "USD" | "MXN";
  onUpdate: (globalIdx: number, field: keyof FilaCostoLocal, value: string | number | boolean) => void;
  onRemove: (globalIdx: number) => void;
}

export function FilaCostoLocalRow({ fila, gi, moneda, onUpdate, onRemove }: Props) {
  // R-01: los tres campos comparten el mismo patrón de edición local
  // (string crudo mientras hay foco, commit al salir del campo).
  const cantidadField = useNumericField(fila.cantidad, (n) => onUpdate(gi, "cantidad", n), {
    parse: parseCantidad,
    fallback: 1,
  });
  const costoField = useNumericField(fila.costo_unitario, (n) => onUpdate(gi, "costo_unitario", n));
  const ventaField = useNumericField(fila.precio_venta, (n) => onUpdate(gi, "precio_venta", n));
  const cantidadExcedida = cantidadFueraDeRango(fila.cantidad);
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
            {...cantidadField}
            aria-label="Cantidad"
            aria-invalid={cantidadExcedida}
            className="h-8 text-sm text-right w-[80px]"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Costo</span>
          <Input
            type="text" inputMode="decimal"
            {...costoField}
            aria-label="Costo unitario"
            className="h-8 text-sm text-right w-[110px]"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Venta</span>
          <Input
            type="text" inputMode="decimal"
            {...ventaField}
            aria-label="Precio de venta"
            className="h-8 text-sm text-right w-[110px]"
          />
        </div>
        {/* Q-15.9 — totales visibles por partida: el multiplicador queda explícito. */}
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {fila.cantidad} × costo = {formatCurrency(costoTotal, moneda)} · venta {formatCurrency(ventaTotal, moneda)}
        </span>
        {cantidadExcedida && (
          <span className="text-2xs text-destructive whitespace-nowrap">
            Cantidad mayor a {formatNumber(CANTIDAD_LIMITE_SANIDAD)} — verifica el dato.
          </span>
        )}
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
