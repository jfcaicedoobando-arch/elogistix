import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { ProfitBadge } from "@/components/shared/ProfitBadge";
import type { FilaCostoLocal } from "./SeccionCostosInternosPLUnificado";
import type { TotalesPL } from "@/lib/financial/profitUtils";
import { FilaCostoLocalRow } from "./costosLocal/FilaCostoLocalRow";

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

export default function TablaCostosLocal({ filas, filasMoneda, moneda, title, icon, totales, onUpdate, onAdd, onRemove }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">{icon} {title}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => onAdd(moneda)}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-x-auto">
          {filasMoneda.length === 0 && (
            <div className="text-center text-muted-foreground py-6 text-sm">
              Sin costos. Haz clic en "Agregar" para comenzar.
            </div>
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
          {filasMoneda.length > 0 && (
            <div className="bg-muted/50 px-3 py-3 flex items-center gap-2 font-semibold text-sm">
              <span className="flex-1">Totales</span>
              <div className="flex items-center gap-2">
                <span className="w-[110px] text-right">{formatCurrency(totales.totalCosto, moneda)}</span>
                <span className="w-[110px] text-right">{formatCurrency(totales.totalVenta, moneda)}</span>
                <span className={`w-[100px] text-right ${totales.profit >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(totales.profit, moneda)}
                </span>
                <div className="w-[70px] flex justify-center"><ProfitBadge porcentaje={totales.porcentaje} /></div>
                <div className="w-8" />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
