import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatNumber } from "@/lib/formatters";
import { WizardSection } from "@/components/shared/WizardSection";
import { ProfitBadge } from "@/features/cotizacion/components/ProfitBadge";
import type { FilaCostoLocal } from "./SeccionCostosInternosPLUnificado";
import type { TotalesPL } from "@/lib/financial/profitUtils";
import { FilaCostoLocalRow } from "./costosLocal/FilaCostoLocalRow";
import { COL_COSTO, COSTO_GRID_MIN_W } from "./costosLocal/columnasCosto";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { cn } from "@/lib/utils";

function getGlobalIndex(filas: { moneda: string }[], moneda: string, localIdx: number) {
  let count = 0;
  for (let i = 0; i < filas.length; i++) {
    if (filas[i].moneda === moneda) {
      if (count === localIdx) return i;
      count++;
    }
  }
  return -1;
}

interface Props {
  filas: FilaCostoLocal[];
  filasMoneda: FilaCostoLocal[];
  moneda: "USD" | "MXN";
  title: string;
  icon: React.ReactNode;
  totales: TotalesPL;
  onUpdate: (globalIdx: number, field: keyof FilaCostoLocal, value: string | number | boolean) => void;
  onAdd: (moneda: "USD" | "MXN") => void;
  onRemove: (globalIdx: number) => void;
}

/** Encabezado de columnas: comparte anchos con la fila y el pie de totales. */
function EncabezadoColumnas() {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b bg-muted/40 px-3 py-2 text-overline text-muted-foreground",
        COSTO_GRID_MIN_W,
      )}
    >
      <span className={COL_COSTO.concepto}>Concepto</span>
      <span className={COL_COSTO.proveedor}>Proveedor</span>
      <span className={COL_COSTO.unidad}>Unidad</span>
      <span className={cn("text-right", COL_COSTO.cantidad)}>Cant.</span>
      <span className={cn("text-right", COL_COSTO.costoUnitario)}>Costo unit.</span>
      <span className={cn("text-right", COL_COSTO.ventaUnitaria)}>Venta unit.</span>
      <span className={cn("text-right", COL_COSTO.costoTotal)}>Costo total</span>
      <span className={cn("text-right", COL_COSTO.ventaTotal)}>Venta total</span>
      <span className={cn("text-right", COL_COSTO.utilidad)}>Utilidad</span>
      <span className={cn("text-center", COL_COSTO.margen)}>Margen</span>
      <span className={COL_COSTO.acciones} />
    </div>
  );
}

export default function TablaCostosLocal({ filas, filasMoneda, moneda, title, icon, totales, onUpdate, onAdd, onRemove }: Props) {
  const hayFilas = filasMoneda.length > 0;

  return (
    <WizardSection
      title={title}
      icon={icon}
      description={`Importes en ${moneda}`}
      actions={
        <Button variant="outline" size="sm" onClick={() => onAdd(moneda)}>
          <Plus className="h-4 w-4 mr-1" /> Agregar
        </Button>
      }
      contentClassName="space-y-0"
    >

      <div className="border rounded-md overflow-x-auto">
        {hayFilas && <EncabezadoColumnas />}
        {!hayFilas && (
          <EmptyStateInline message='Sin costos. Haz clic en "Agregar" para comenzar.' className="py-6" />
        )}
        {filasMoneda.map((fila, idx) => (
          <FilaCostoLocalRow
            key={idx}
            fila={fila}
            gi={getGlobalIndex(filas, moneda, idx)}
            moneda={moneda}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ))}
        {hayFilas && (
          <div
            className={cn(
              "flex items-center gap-2 bg-muted/50 px-3 py-3 font-semibold text-body",
              COSTO_GRID_MIN_W,
            )}
          >
            <span className={COL_COSTO.concepto}>Totales</span>
            {/* v13.823.286 — en pantallas medianas las columnas calculadas están
                ocultas: el pie muestra las cifras en una línea compacta. */}
            <span className="xl:hidden flex-1 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 tabular-nums">
              <span className="text-muted-foreground font-normal">
                Costo <span className="font-semibold text-foreground">{formatNumber(totales.totalCosto, { decimals: 2 })}</span>
              </span>
              <span className="text-muted-foreground font-normal">
                Venta <span className="font-semibold text-foreground">{formatNumber(totales.totalVenta, { decimals: 2 })}</span>
              </span>
              <span className="text-muted-foreground font-normal">
                Utilidad{" "}
                <span className={cn("font-semibold", totales.profit >= 0 ? "text-success" : "text-destructive")}>
                  {formatNumber(totales.profit, { decimals: 2 })}
                </span>
              </span>
              <ProfitBadge porcentaje={totales.porcentaje} />
            </span>
            <span className={cn("hidden xl:block", COL_COSTO.proveedor)} />
            <span className={cn("hidden xl:block", COL_COSTO.unidad)} />
            <span className={cn("hidden xl:block", COL_COSTO.cantidad)} />
            <span className={cn("hidden xl:block", COL_COSTO.costoUnitario)} />
            <span className={cn("hidden xl:block", COL_COSTO.ventaUnitaria)} />
            <span className={cn("text-right tabular-nums", COL_COSTO.costoTotal)}>
              {formatNumber(totales.totalCosto, { decimals: 2 })}
            </span>
            <span className={cn("text-right tabular-nums", COL_COSTO.ventaTotal)}>
              {formatNumber(totales.totalVenta, { decimals: 2 })}
            </span>
            <span
              className={cn(
                "text-right tabular-nums",
                COL_COSTO.utilidad,
                totales.profit >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {formatNumber(totales.profit, { decimals: 2 })}
            </span>

            <div className={cn("flex justify-center", COL_COSTO.margen)}>
              <ProfitBadge porcentaje={totales.porcentaje} />
            </div>
            <span className={COL_COSTO.acciones} />
          </div>
        )}
      </div>
    </WizardSection>
  );
}
