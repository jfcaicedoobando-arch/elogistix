import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DollarSign, Banknote, TrendingUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

const CONCEPTOS_USD = [
  'Cargos en Origen', 'Costos Portuarios', 'Consolidación', 'Seguro',
  'Recolección', 'Modificación de BL', 'Flete Marítimo', 'Flete Aéreo',
  'Flete Terrestre', 'Handling', 'Desconsolidación', 'Revalidación',
  'Demoras', 'Cargos en Destino', 'Release', 'Otro'
];
const CONCEPTOS_MXN = ['Entrega Nacional', 'Honorarios de Despacho Aduanal', 'Otro'];
const UNIDADES_MEDIDA = ['BL', 'W/M', 'Documento', 'Contenedor', 'Kilo', 'Embarque'];

export interface FilaCostoLocal {
  concepto: string;
  moneda: "USD" | "MXN";
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  precio_venta: number;
  unidad_medida: string;
  aplica_iva?: boolean;
}

interface Props {
  filas: FilaCostoLocal[];
  setFilas: React.Dispatch<React.SetStateAction<FilaCostoLocal[]>>;
}

function profitBadge(profit: number) {
  if (profit > 15) return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{profit.toFixed(1)}%</Badge>;
  if (profit > 0) return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{profit.toFixed(1)}%</Badge>;
  if (profit < 0) return <Badge className="bg-red-100 text-red-700 border-red-200">{profit.toFixed(1)}%</Badge>;
  return <Badge variant="secondary">0%</Badge>;
}

function rentabilidadGlobal(pctUSD: number, pctMXN: number, hasUSD: boolean, hasMXN: boolean) {
  const usdOk = !hasUSD || pctUSD > 15;
  const mxnOk = !hasMXN || pctMXN > 10;
  if (usdOk && mxnOk && (hasUSD || hasMXN)) return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-sm">Rentabilidad Saludable</Badge>;
  const usdNeg = hasUSD && pctUSD < 0;
  const mxnNeg = hasMXN && pctMXN < 0;
  if (usdNeg || mxnNeg) return <Badge className="bg-red-100 text-red-700 border-red-200 text-sm">Rentabilidad Negativa</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-sm">Rentabilidad Baja</Badge>;
}

export default function SeccionCostosInternosPLLocal({ filas, setFilas }: Props) {
  const filasUSD = useMemo(() => filas.filter(f => f.moneda === "USD"), [filas]);
  const filasMXN = useMemo(() => filas.filter(f => f.moneda === "MXN"), [filas]);

  const updateFila = (globalIdx: number, field: keyof FilaCostoLocal, value: any) => {
    setFilas(prev => {
      const copy = [...prev];
      copy[globalIdx] = { ...copy[globalIdx], [field]: value };
      return copy;
    });
  };

  const addFila = (moneda: "USD" | "MXN") => {
    setFilas(prev => [...prev, {
      concepto: "", moneda, proveedor: "", cantidad: 1,
      costo_unitario: 0, precio_venta: 0, unidad_medida: "",
      aplica_iva: moneda === "MXN",
    }]);
  };

  const removeFila = (globalIdx: number) => {
    setFilas(prev => prev.filter((_, i) => i !== globalIdx));
  };

  const getGlobalIndex = (moneda: "USD" | "MXN", localIdx: number) => {
    let count = 0;
    for (let i = 0; i < filas.length; i++) {
      if (filas[i].moneda === moneda) {
        if (count === localIdx) return i;
        count++;
      }
    }
    return -1;
  };

  const calcTotals = (rows: FilaCostoLocal[]) => {
    const totalCosto = rows.reduce((s, f) => s + f.cantidad * f.costo_unitario, 0);
    const totalVenta = rows.reduce((s, f) => s + f.cantidad * f.precio_venta, 0);
    const profit = totalVenta - totalCosto;
    const pct = totalVenta !== 0 ? (profit / totalVenta) * 100 : 0;
    return { totalCosto, totalVenta, profit, pct };
  };

  const totalesUSD = useMemo(() => calcTotals(filasUSD), [filasUSD]);
  const totalesMXN = useMemo(() => calcTotals(filasMXN), [filasMXN]);

  const renderRows = (rows: FilaCostoLocal[], moneda: "USD" | "MXN", title: string, icon: React.ReactNode) => {
    const tots = moneda === "USD" ? totalesUSD : totalesMXN;
    const catalogo = moneda === "USD" ? CONCEPTOS_USD : CONCEPTOS_MXN;

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {icon} {title}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => addFila(moneda)}>
              <Plus className="h-4 w-4 mr-1" /> Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            {rows.length === 0 && (
              <div className="text-center text-muted-foreground py-6 text-sm">
                Sin costos. Haz clic en "Agregar" para comenzar.
              </div>
            )}
            {rows.map((fila, idx) => {
              const costoTotal = fila.cantidad * fila.costo_unitario;
              const ventaTotal = fila.cantidad * fila.precio_venta;
              const profit = ventaTotal - costoTotal;
              const pct = ventaTotal !== 0 ? (profit / ventaTotal) * 100 : 0;
              const gi = getGlobalIndex(moneda, idx);

              // Build concept options, include current value if not in catalog
              const conceptOptions = [...catalogo];
              if (fila.concepto && !conceptOptions.includes(fila.concepto)) {
                conceptOptions.unshift(fila.concepto);
              }

              return (
                <div key={idx} className="border-b border-slate-100 last:border-b-0 py-3 px-3 space-y-1">
                  {/* Línea 1: Concepto, Proveedor, Unidad */}
                  <div className="flex items-center gap-2">
                    <Select value={fila.concepto || "sin_concepto"} onValueChange={v => updateFila(gi, "concepto", v === "sin_concepto" ? "" : v)}>
                      <SelectTrigger className="h-8 text-sm min-w-[180px] flex-1">
                        <SelectValue placeholder="Concepto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sin_concepto">— Seleccionar —</SelectItem>
                        {conceptOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      value={fila.proveedor}
                      onChange={e => updateFila(gi, "proveedor", e.target.value)}
                      className="h-8 text-sm w-[120px]" placeholder="Proveedor"
                    />
                    <Select value={fila.unidad_medida || "sin_unidad"} onValueChange={v => updateFila(gi, "unidad_medida", v === "sin_unidad" ? "" : v)}>
                      <SelectTrigger className="h-8 text-sm w-[110px]">
                        <SelectValue placeholder="Unidad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sin_unidad">—</SelectItem>
                        {UNIDADES_MEDIDA.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Línea 2: Cantidad, Costo, Venta, Profit, %, Eliminar */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Cant.</span>
                      <Input
                        type="text" inputMode="numeric"
                        value={fila.cantidad === 0 ? '' : fila.cantidad}
                        onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9]/g, '');
                          updateFila(gi, "cantidad", raw === '' ? 0 : parseInt(raw, 10));
                        }}
                        onBlur={e => { if (e.target.value === '') updateFila(gi, "cantidad", 1); }}
                        className="h-8 text-sm text-right w-[80px]"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Costo</span>
                      <Input
                        type="text" inputMode="decimal"
                        value={fila.costo_unitario === 0 ? '' : fila.costo_unitario}
                        onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9.]/g, '');
                          updateFila(gi, "costo_unitario", raw === '' ? 0 : parseFloat(raw));
                        }}
                        onBlur={e => { if (e.target.value === '') updateFila(gi, "costo_unitario", 0); }}
                        className="h-8 text-sm text-right w-[110px]"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Venta</span>
                      <Input
                        type="text" inputMode="decimal"
                        value={fila.precio_venta === 0 ? '' : fila.precio_venta}
                        onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9.]/g, '');
                          updateFila(gi, "precio_venta", raw === '' ? 0 : parseFloat(raw));
                        }}
                        onBlur={e => { if (e.target.value === '') updateFila(gi, "precio_venta", 0); }}
                        className="h-8 text-sm text-right w-[110px]"
                      />
                    </div>
                    <span className={`text-sm font-medium w-[100px] text-right ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {formatCurrency(profit, moneda)}
                    </span>
                    <div className="w-[70px] flex justify-center">{profitBadge(pct)}</div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFila(gi)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {/* Totales */}
            {rows.length > 0 && (
              <div className="bg-muted/50 px-3 py-3 flex items-center gap-2 font-semibold text-sm">
                <span className="flex-1">Totales</span>
                <div className="flex items-center gap-2">
                  <span className="w-[110px] text-right">{formatCurrency(tots.totalCosto, moneda)}</span>
                  <span className="w-[110px] text-right">{formatCurrency(tots.totalVenta, moneda)}</span>
                  <span className={`w-[100px] text-right ${tots.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(tots.profit, moneda)}
                  </span>
                  <div className="w-[70px] flex justify-center">{profitBadge(tots.pct)}</div>
                  <div className="w-8" />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {renderRows(filasUSD, "USD", "Costos en USD", <DollarSign className="h-4 w-4 text-violet-500" />)}
      {renderRows(filasMXN, "MXN", "Costos en MXN", <Banknote className="h-4 w-4 text-violet-500" />)}

      {(filasUSD.length > 0 || filasMXN.length > 0) && (
        <Collapsible defaultOpen>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-violet-500" />
                  Resumen P&L
                  <div className="ml-auto flex items-center gap-2">
                    {rentabilidadGlobal(totalesUSD.pct, totalesMXN.pct, filasUSD.length > 0, filasMXN.length > 0)}
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filasUSD.length > 0 && (
                    <Card className="border-violet-100">
                      <CardContent className="p-4 space-y-2">
                        <p className="text-sm font-semibold text-violet-600">USD</p>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Costo</span>
                          <span>{formatCurrency(totalesUSD.totalCosto, "USD")}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Venta</span>
                          <span>{formatCurrency(totalesUSD.totalVenta, "USD")}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Profit</span>
                          <span className={totalesUSD.profit >= 0 ? "text-emerald-600" : "text-red-600"}>
                            {formatCurrency(totalesUSD.profit, "USD")}
                          </span>
                        </div>
                        <div className="flex justify-center pt-1">{profitBadge(totalesUSD.pct)}</div>
                      </CardContent>
                    </Card>
                  )}
                  {filasMXN.length > 0 && (
                    <Card className="border-violet-100">
                      <CardContent className="p-4 space-y-2">
                        <p className="text-sm font-semibold text-violet-600">MXN</p>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Costo</span>
                          <span>{formatCurrency(totalesMXN.totalCosto, "MXN")}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Venta</span>
                          <span>{formatCurrency(totalesMXN.totalVenta, "MXN")}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Profit</span>
                          <span className={totalesMXN.profit >= 0 ? "text-emerald-600" : "text-red-600"}>
                            {formatCurrency(totalesMXN.profit, "MXN")}
                          </span>
                        </div>
                        <div className="flex justify-center pt-1">{profitBadge(totalesMXN.pct)}</div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
