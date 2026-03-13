import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { DollarSign, Banknote, Save, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { usePermissions } from "@/hooks/usePermissions";
import {
  useCotizacionCostos, useUpsertCotizacionCostos, CostoCotizacion,
} from "@/hooks/useCotizacionCostos";
import type { ConceptoVentaCotizacion } from "@/hooks/useCotizaciones";
import { formatCurrency } from "@/lib/formatters";
import { calcularUtilidad, calcularMargen } from "@/lib/financialUtils";
import { ProfitBadge, calcularTotalesPL } from "@/lib/profitUtils";
import { CONCEPTOS_COSTO_USD, CONCEPTOS_COSTO_MXN } from "@/data/cotizacionConstants";
import ResumenPL from "./ResumenPL";

// ─── Shared types ────────────────────────────────────────────
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

interface FilaCostoDetalle {
  concepto: string;
  moneda: "USD" | "MXN";
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  venta: number;
  aplica_iva?: boolean;
}

// ─── Discriminated union props ───────────────────────────────
interface PropsLocal {
  tipo: "local";
  filas: FilaCostoLocal[];
  setFilas: React.Dispatch<React.SetStateAction<FilaCostoLocal[]>>;
}

interface PropsDetalle {
  tipo: "detalle";
  cotizacionId: string;
  conceptosUSD: ConceptoVentaCotizacion[];
  conceptosMXN: ConceptoVentaCotizacion[];
}

type Props = PropsLocal | PropsDetalle;

const UNIDADES_MEDIDA = ['BL', 'W/M', 'Documento', 'Contenedor', 'Kilo', 'Embarque'];

// ─── Shared utilities ────────────────────────────────────────
/** Adapta filas con shape {cantidad, costo, venta} al formato de calcularTotalesPL */
function calcTotals(rows: { cantidad: number; costo: number; venta: number }[]) {
  return calcularTotalesPL(
    rows.map(r => ({ cantidad: r.cantidad, costo_unitario: r.costo, precio_venta: r.venta / (r.cantidad || 1) }))
  );
}

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

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════
export default function SeccionCostosInternosPLUnificado(props: Props) {
  if (props.tipo === "local") return <ModoLocal {...props} />;
  return <ModoDetalle {...props} />;
}

// ═══════════════════════════════════════════════════════════════
// MODO LOCAL (NuevaCotizacion wizard)
// ═══════════════════════════════════════════════════════════════
function ModoLocal({ filas, setFilas }: PropsLocal) {
  const filasUSD = useMemo(() => filas.filter(f => f.moneda === "USD"), [filas]);
  const filasMXN = useMemo(() => filas.filter(f => f.moneda === "MXN"), [filas]);

  const [editingQty, setEditingQty] = useState<{ idx: number; raw: string } | null>(null);

  const updateFila = (globalIdx: number, field: keyof FilaCostoLocal, value: string | number | boolean) => {
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

  const totalesUSD = useMemo(() => calcTotals(
    filasUSD.map(f => ({ cantidad: f.cantidad, costo: f.costo_unitario, venta: f.cantidad * f.precio_venta }))
  ), [filasUSD]);

  const totalesMXN = useMemo(() => calcTotals(
    filasMXN.map(f => ({ cantidad: f.cantidad, costo: f.costo_unitario, venta: f.cantidad * f.precio_venta }))
  ), [filasMXN]);

  const renderRows = (rows: FilaCostoLocal[], moneda: "USD" | "MXN", title: string, icon: React.ReactNode) => {
    const tots = moneda === "USD" ? totalesUSD : totalesMXN;
    const catalogo: readonly string[] = moneda === "USD" ? CONCEPTOS_COSTO_USD : CONCEPTOS_COSTO_MXN;

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">{icon} {title}</CardTitle>
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
                    <Select value={fila.concepto || "sin_concepto"} onValueChange={v => updateFila(gi, "concepto", v === "sin_concepto" ? "" : v)}>
                      <SelectTrigger className="h-8 text-sm min-w-[180px] flex-1"><SelectValue placeholder="Concepto" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sin_concepto">— Seleccionar —</SelectItem>
                        {conceptOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input value={fila.proveedor} onChange={e => updateFila(gi, "proveedor", e.target.value)} className="h-8 text-sm w-[120px]" placeholder="Proveedor" />
                    <Select value={fila.unidad_medida || "sin_unidad"} onValueChange={v => updateFila(gi, "unidad_medida", v === "sin_unidad" ? "" : v)}>
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
                          if (!isNaN(num)) updateFila(gi, "cantidad", num);
                          else if (raw === '') updateFila(gi, "cantidad", 0);
                        }}
                        onBlur={() => { setEditingQty(null); if (fila.cantidad === 0 || isNaN(fila.cantidad)) updateFila(gi, "cantidad", 1); }}
                        className="h-8 text-sm text-right w-[80px]"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Costo</span>
                      <Input type="text" inputMode="decimal" value={fila.costo_unitario === 0 ? '' : fila.costo_unitario}
                        onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
                        onChange={e => { const raw = e.target.value.replace(/[^0-9.]/g, ''); updateFila(gi, "costo_unitario", raw === '' ? 0 : parseFloat(raw)); }}
                        onBlur={e => { if (e.target.value === '') updateFila(gi, "costo_unitario", 0); }}
                        className="h-8 text-sm text-right w-[110px]"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Venta</span>
                      <Input type="text" inputMode="decimal" value={fila.precio_venta === 0 ? '' : fila.precio_venta}
                        onFocus={e => { if (e.target.value === '0') e.target.value = ''; }}
                        onChange={e => { const raw = e.target.value.replace(/[^0-9.]/g, ''); updateFila(gi, "precio_venta", raw === '' ? 0 : parseFloat(raw)); }}
                        onBlur={e => { if (e.target.value === '') updateFila(gi, "precio_venta", 0); }}
                        className="h-8 text-sm text-right w-[110px]"
                      />
                    </div>
                    <span className={`text-sm font-medium w-[100px] text-right ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {formatCurrency(profit, moneda)}
                    </span>
                    <div className="w-[70px] flex justify-center"><ProfitBadge porcentaje={pct} /></div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFila(gi)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {rows.length > 0 && (
              <div className="bg-muted/50 px-3 py-3 flex items-center gap-2 font-semibold text-sm">
                <span className="flex-1">Totales</span>
                <div className="flex items-center gap-2">
                  <span className="w-[110px] text-right">{formatCurrency(tots.totalCosto, moneda)}</span>
                  <span className="w-[110px] text-right">{formatCurrency(tots.totalVenta, moneda)}</span>
                  <span className={`w-[100px] text-right ${tots.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(tots.profit, moneda)}
                  </span>
                  <div className="w-[70px] flex justify-center"><ProfitBadge porcentaje={tots.porcentaje} /></div>
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
      <ResumenPL
        totalesUSD={totalesUSD} totalesMXN={totalesMXN}
        tieneUSD={filasUSD.length > 0} tieneMXN={filasMXN.length > 0}
        mostrarRentabilidadGlobal
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODO DETALLE (CotizacionDetalle — loads from DB)
// ═══════════════════════════════════════════════════════════════
function ModoDetalle({ cotizacionId, conceptosUSD, conceptosMXN }: PropsDetalle) {
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const { data: costosGuardados, isLoading } = useCotizacionCostos(cotizacionId);
  const upsert = useUpsertCotizacionCostos();

  const [filas, setFilas] = useState<FilaCostoDetalle[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isLoading || initialized) return;

    if (costosGuardados && costosGuardados.length > 0) {
      const mapped: FilaCostoDetalle[] = costosGuardados.map((c) => {
        let venta = 0;
        let aplica_iva = false;
        if (c.moneda === "USD") {
          const cv = conceptosUSD.find((v) => v.descripcion === c.concepto);
          venta = cv ? cv.cantidad * cv.precio_unitario : 0;
          aplica_iva = cv?.aplica_iva ?? false;
        } else {
          const cv = conceptosMXN.find((v) => v.descripcion === c.concepto);
          venta = cv ? cv.cantidad * cv.precio_unitario : 0;
        }
        return { concepto: c.concepto, moneda: c.moneda as "USD" | "MXN", proveedor: c.proveedor, cantidad: c.cantidad, costo_unitario: c.costo_unitario, venta, aplica_iva };
      });
      setFilas(mapped);
    } else {
      const fromUSD: FilaCostoDetalle[] = conceptosUSD.map((c) => ({
        concepto: c.descripcion, moneda: "USD" as const, proveedor: "", cantidad: c.cantidad, costo_unitario: 0,
        venta: c.cantidad * c.precio_unitario, aplica_iva: c.aplica_iva ?? false,
      }));
      const fromMXN: FilaCostoDetalle[] = conceptosMXN.map((c) => ({
        concepto: c.descripcion, moneda: "MXN" as const, proveedor: "", cantidad: c.cantidad, costo_unitario: 0,
        venta: c.cantidad * c.precio_unitario,
      }));
      setFilas([...fromUSD, ...fromMXN]);
    }
    setInitialized(true);
  }, [isLoading, costosGuardados, conceptosUSD, conceptosMXN, initialized]);

  const filasUSD = useMemo(() => filas.filter(f => f.moneda === "USD"), [filas]);
  const filasMXN = useMemo(() => filas.filter(f => f.moneda === "MXN"), [filas]);

  const updateFila = (index: number, field: "proveedor" | "costo_unitario", value: string) => {
    setFilas(prev => {
      const copy = [...prev];
      if (field === "costo_unitario") copy[index] = { ...copy[index], costo_unitario: parseFloat(value) || 0 };
      else copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const totalesUSD = useMemo(() => calcTotals(
    filasUSD.map(f => ({ cantidad: f.cantidad, costo: f.costo_unitario, venta: f.venta }))
  ), [filasUSD]);

  const totalesMXN = useMemo(() => calcTotals(
    filasMXN.map(f => ({ cantidad: f.cantidad, costo: f.costo_unitario, venta: f.venta }))
  ), [filasMXN]);

  const handleGuardar = async () => {
    const costos: CostoCotizacion[] = filas.map((f) => ({
      id: "", cotizacion_id: cotizacionId, concepto: f.concepto, moneda: f.moneda,
      proveedor: f.proveedor, cantidad: f.cantidad, costo_unitario: f.costo_unitario,
      costo_total: f.cantidad * f.costo_unitario, created_at: "", updated_at: "",
    }));
    try {
      await upsert.mutateAsync({ cotizacionId, costos });
      toast({ title: "Costos guardados correctamente" });
    } catch (err: unknown) {
      toast({ title: "Error al guardar", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  if (isLoading) return null;

  const renderTable = (rows: FilaCostoDetalle[], moneda: "USD" | "MXN", title: string, icon: React.ReactNode) => {
    if (rows.length === 0) return null;
    const tots = moneda === "USD" ? totalesUSD : totalesMXN;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">{icon} {title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Costo Unit.</TableHead>
                  <TableHead className="text-right">Venta</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">% Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((fila, idx) => {
                  const costo = fila.cantidad * fila.costo_unitario;
                  const profit = calcularUtilidad(fila.venta, costo);
                  const pct = calcularMargen(fila.venta, costo);
                  const globalIdx = getGlobalIndex(filas, moneda, idx);

                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-sm">{fila.concepto}</TableCell>
                      <TableCell>
                        {canEdit ? (
                          <Input value={fila.proveedor} onChange={e => updateFila(globalIdx, "proveedor", e.target.value)} className="h-8 text-sm" placeholder="Proveedor" />
                        ) : <span className="text-sm">{fila.proveedor || "-"}</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit ? (
                          <Input type="number" value={fila.costo_unitario || ""} onChange={e => updateFila(globalIdx, "costo_unitario", e.target.value)} className="h-8 text-sm text-right w-28 ml-auto" min={0} step={0.01} />
                        ) : <span className="text-sm">{formatCurrency(fila.costo_unitario, moneda)}</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(fila.venta, moneda)}
                        {fila.aplica_iva && <span className="text-xs text-muted-foreground ml-1">+ IVA</span>}
                      </TableCell>
                      <TableCell className={`text-right text-sm font-medium ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {formatCurrency(profit, moneda)}
                      </TableCell>
                      <TableCell className="text-right"><ProfitBadge porcentaje={pct} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell colSpan={2}>Totales</TableCell>
                  <TableCell className="text-right">{formatCurrency(tots.totalCosto, moneda)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(tots.totalVenta, moneda)}</TableCell>
                  <TableCell className={`text-right ${tots.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(tots.profit, moneda)}
                  </TableCell>
                  <TableCell className="text-right"><ProfitBadge porcentaje={tots.porcentaje} /></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          {moneda === "MXN" && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-muted-foreground">* P&L calculado sobre subtotales sin IVA</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {renderTable(filasUSD, "USD", "Costos en USD", <DollarSign className="h-4 w-4 text-violet-500" />)}
      {renderTable(filasMXN, "MXN", "Costos en MXN", <Banknote className="h-4 w-4 text-violet-500" />)}
      <ResumenPL
        totalesUSD={totalesUSD} totalesMXN={totalesMXN}
        tieneUSD={filasUSD.length > 0} tieneMXN={filasMXN.length > 0}
        notaPie="El IVA no forma parte del profit"
      />
      {canEdit && filas.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={handleGuardar} disabled={upsert.isPending}>
            <Save className="h-4 w-4 mr-1" />
            {upsert.isPending ? "Guardando..." : "Guardar Costos"}
          </Button>
        </div>
      )}
    </div>
  );
}
