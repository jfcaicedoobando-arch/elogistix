import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, StickyNote } from "lucide-react";
import { formatNumber } from "@/lib/formatters";
import { ProfitBadge } from "@/features/cotizacion/components/ProfitBadge";
import { ProductoServicioSelect } from "@/features/cotizacion/components/conceptos/ProductoServicioSelect";
import { UnidadMedidaSelect } from "@/features/cotizacion/components/conceptos/UnidadMedidaSelect";
import type { FilaCostoLocal } from "../SeccionCostosInternosPLUnificado";
import { COL_COSTO, COSTO_GRID_MIN_W } from "./columnasCosto";
import { cn } from "@/lib/utils";
import { Hint } from "@/components/shared/Hint";
import { useFilaCostoLocalRow } from "../../hooks/useFilaCostoLocalRow";
import { AvisosFilaCosto } from "./AvisosFilaCosto";

interface Props {
  fila: FilaCostoLocal;
  gi: number;
  /** Moneda del bloque; se muestra en el título de la sección, no por celda. */
  moneda: "USD" | "MXN";
  onUpdate: (globalIdx: number, field: keyof FilaCostoLocal, value: string | number | boolean) => void;
  onRemove: (globalIdx: number) => void;
}

export function FilaCostoLocalRow({ fila, gi, onUpdate, onRemove }: Props) {
  const {
    cantidadField,
    costoField,
    ventaField,
    cantidadExcedida,
    costoTotal,
    ventaTotal,
    profit,
    pct,
    conceptoFaltante,
    proveedorFaltante,
    mostrarNotas,
    toggleNotas,
    handleProductoSelect,
    handleConceptoLibre,
  } = useFilaCostoLocalRow(fila, gi, onUpdate);

  return (
    <div
      className={cn(
        "border-b border-border last:border-b-0 py-2 px-3",
        conceptoFaltante && "bg-destructive/5",
      )}
    >
      <div className={cn("flex items-center gap-2", COSTO_GRID_MIN_W)}>
        <div className={COL_COSTO.concepto}>
          {/* Combobox estricto contra `catalogo_claves_sat` — mismo origen que el paso 3. */}
          <ProductoServicioSelect
            value={fila.concepto}
            onSelect={handleProductoSelect}
            onConceptoLibre={handleConceptoLibre}
            placeholder="Selecciona concepto"
          />
        </div>

        {/* El nombre largo se corta en el campo; el valor completo se lee
            en un tooltip accesible en vez de ensanchar la columna. */}
        <Hint label={fila.proveedor || undefined}>
          <Input
            value={fila.proveedor}
            onChange={(e) => onUpdate(gi, "proveedor", e.target.value)}
            aria-invalid={proveedorFaltante}
            className={cn(
              "h-9 text-body",
              COL_COSTO.proveedor,
              proveedorFaltante && "border-destructive",
            )}
            placeholder="Proveedor"
            aria-label="Proveedor"
          />
        </Hint>

        <div className={COL_COSTO.unidad}>
          <UnidadMedidaSelect
            value={fila.unidad_medida}
            onChange={(v) => onUpdate(gi, "unidad_medida", v)}
          />
        </div>

        <Input
          type="text" inputMode="decimal"
          {...cantidadField}
          aria-label="Cantidad"
          aria-invalid={cantidadExcedida}
          className={cn("h-9 text-body text-right", COL_COSTO.cantidad)}
        />
        <Input
          type="text" inputMode="decimal"
          {...costoField}
          aria-label="Costo unitario"
          className={cn("h-9 text-body text-right", COL_COSTO.costoUnitario)}
        />
        <Input
          type="text" inputMode="decimal"
          {...ventaField}
          aria-label="Precio de venta"
          className={cn("h-9 text-body text-right", COL_COSTO.ventaUnitaria)}
        />

        {/* Q-15.9 — importes por partida, bajo su propio encabezado. Sin
            prefijo de moneda: ya está en el título de la sección, y repetirlo
            partía las cifras en dos líneas. */}
        <span className={cn("text-body text-right tabular-nums", COL_COSTO.costoTotal)}>
          {formatNumber(costoTotal, { decimals: 2 })}
        </span>
        <span className={cn("text-body text-right tabular-nums", COL_COSTO.ventaTotal)}>
          {formatNumber(ventaTotal, { decimals: 2 })}
        </span>
        <span
          className={cn(
            "text-body font-medium text-right tabular-nums",
            COL_COSTO.utilidad,
            profit >= 0 ? "text-success" : "text-destructive",
          )}
        >
          {formatNumber(profit, { decimals: 2 })}
        </span>

        <div className={cn("flex justify-center", COL_COSTO.margen)}>
          <ProfitBadge porcentaje={pct} venta={ventaTotal} />
        </div>

        <div className={cn("flex items-center justify-end gap-1", COL_COSTO.acciones)}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label={mostrarNotas ? "Ocultar notas" : "Agregar notas"}
            aria-expanded={mostrarNotas}
            onClick={toggleNotas}
          >
            <StickyNote className={cn("h-4 w-4", fila.notas ? "text-primary" : "text-muted-foreground")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onRemove(gi)}
            aria-label="Eliminar concepto"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 border-t border-border/60 pt-2 text-label tabular-nums 2xl:hidden">
        <span className="text-muted-foreground">Costo total <strong className="text-foreground">{formatNumber(costoTotal, { decimals: 2 })}</strong></span>
        <span className="text-muted-foreground">Venta total <strong className="text-foreground">{formatNumber(ventaTotal, { decimals: 2 })}</strong></span>
        <span className="text-muted-foreground">
          Utilidad <strong className={profit >= 0 ? "text-success" : "text-destructive"}>{formatNumber(profit, { decimals: 2 })}</strong>
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">Margen <ProfitBadge porcentaje={pct} venta={ventaTotal} /></span>
      </div>

      <AvisosFilaCosto
        gi={gi}
        conceptoLibre={!!fila.concepto_libre}
        conceptoFaltante={conceptoFaltante}
        proveedorFaltante={proveedorFaltante}
        cantidadExcedida={cantidadExcedida}
      />

      {mostrarNotas && (
        <Textarea
          rows={1}
          placeholder="Notas (opcional)"
          value={fila.notas || ""}
          onChange={(e) => onUpdate(gi, "notas", e.target.value)}
          aria-label="Notas del concepto"
          className="mt-2 min-h-9 h-9 py-2 text-body-sm resize-y"
        />
      )}
    </div>
  );
}
