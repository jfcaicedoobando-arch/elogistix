import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { calcularUtilidad, calcularMargen } from "@/lib/financialUtils";
import { ProfitBadge } from "@/components/shared/ProfitBadge";
import { CONCEPTOS_COSTO_USD, CONCEPTOS_COSTO_MXN } from "@/constants/cotizacionConstants";
import type { FilaCostoLocal } from "./SeccionCostosInternosPLUnificado";
import type { TotalesPL } from "@/lib/profitUtils";

const UNIDADES_MEDIDA = ['BL', 'W/M', 'Documento', 'Contenedor', 'Kilo', 'Embarque'];

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
  const [editingQty, setEditingQty] = useState<{ idx: number; raw: string } | null>(null);
  const catalogo: readonly string[] = moneda === "USD" ? CONCEPTOS_COSTO_USD : CONCEPTOS_COSTO_MXN;

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
        <div className="border rounded-md">
          {filasMoneda.length === 0 && (
            <div className="text-center text-muted-foreground py-6 text-sm">
              Sin costos. Haz clic en "Agregar" para comenzar.
            </div>
          )}
          {filasMoneda.map((fila, idx) => {
            const costoTotal = fila.cantidad * fila.costo_unitario;
            const ventaTotal = fila.cantidad * fila.precio_venta;
            const profit = calcularUtilidad(ventaTotal, costoTotal);
            const pct = calcularMargen(ventaTotal, costoTotal);
            const gi = getGlobalIndex(filas, moneda, idx);
            const conceptOptions = [...catalogo];
            if (fila.concepto && !conceptOptions.includes(fila.concepto)) {
              conceptOptions.unshift(fila.concepto);
            }

            return (
              <div key={idx} className="border-b border-slate-100 last:border-b-0 py-3 px-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Select value={fila.concepto || "sin_concepto"} onValueChange={v => onUpdate(gi, "concepto", v === "sin_concepto" ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm min-w-[180px] flex-1"><SelectValue placeholder="Concepto" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sin_concepto">— Seleccionar —</SelectItem>
                      {conceptOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input value={fila.proveedor} onChange={e => onUpdate(gi, "proveedor", e.target.value)} className="h-8 text-sm w-[120px]" placeholder="Proveedor" />
                  <Select value={fila.unidad_medida || "sin_unidad"} onValueChange={v => onUpdate(gi, "unidad_medida", v === "sin_unidad" ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm w-[110px]"><SelectValue placeholder="Unidad" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sin_unidad">—</SelectItem>
                      {UNIDADES_MEDIDA.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Cant.</span>
                    <Input
                      type="text" inputMode="decimal"
                      value={editingQty?.idx === gi ? editingQty.raw : (fila.cantidad === 0 ? '' : String(fila.cantidad))}
                      onFocus={e => {
                        const val = fila.cantidad === 0 ? '' : String(fila.cantidad);
                        setEditingQty({ idx: gi, raw: val });
                        if (e.target.value === '0') e.target.value = '';
                      }}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                        setEditingQty({ idx: gi, raw });
                        const num = parseFloat(raw);
                        if (!isNaN(num)) onUpdate(gi, "cantidad", num);
                        else if (raw === '') onUpdate(gi, "cantidad", 0);
                      }}
                      onBlur={() => { setEditingQty(null); if (fila.cantidad === 0 || isNaN(fila.cantidad)) onUpdate(gi, "cantidad", 1); }}
                      className="h-8 text-sm text-right w-[80px]"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Costo</span>
                    <Input type="text" inputMode="decimal" value={fila.costo_unitario === 0 ? '' : fila.costo_unitario}
                      onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
                      onChange={e => { const raw = e.target.value.replace(/[^0-9.]/g, ''); onUpdate(gi, "costo_unitario", raw === '' ? 0 : parseFloat(raw)); }}
                      onBlur={e => { if (e.target.value === '') onUpdate(gi, "costo_unitario", 0); }}
                      className="h-8 text-sm text-right w-[110px]"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Venta</span>
                    <Input type="text" inputMode="decimal" value={fila.precio_venta === 0 ? '' : fila.precio_venta}
                      onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
                      onChange={e => { const raw = e.target.value.replace(/[^0-9.]/g, ''); onUpdate(gi, "precio_venta", raw === '' ? 0 : parseFloat(raw)); }}
                      onBlur={e => { if (e.target.value === '') onUpdate(gi, "precio_venta", 0); }}
                      className="h-8 text-sm text-right w-[110px]"
                    />
                  </div>
                  <span className={`text-sm font-medium w-[100px] text-right ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(profit, moneda)}
                  </span>
                  <div className="w-[70px] flex justify-center"><ProfitBadge porcentaje={pct} /></div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRemove(gi)}>
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
          })}
          {filasMoneda.length > 0 && (
            <div className="bg-muted/50 px-3 py-3 flex items-center gap-2 font-semibold text-sm">
              <span className="flex-1">Totales</span>
              <div className="flex items-center gap-2">
                <span className="w-[110px] text-right">{formatCurrency(totales.totalCosto, moneda)}</span>
                <span className="w-[110px] text-right">{formatCurrency(totales.totalVenta, moneda)}</span>
                <span className={`w-[100px] text-right ${totales.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
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
