import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import {
  useCotizacionCostos, useUpsertCostos, useDeleteCosto, calcularPL,
  type CostoCotizacion,
} from "@/hooks/useCotizacionCostos";
import type { ConceptoVentaCotizacion } from "@/hooks/useCotizaciones";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, DollarSign, TrendingUp, TrendingDown, Package } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface FilaCosto {
  _key: string;
  id?: string;
  concepto: string;
  proveedor: string;
  moneda: string;
  unidad_medida: string;
  costo: number;
  venta: number;
  seccion: string;
}

const SECCIONES = ["Origen", "Flete Internacional", "Destino", "Otro"];

const SECCION_COLORS: Record<string, string> = {
  "Origen": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Flete Internacional": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "Destino": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "Otro": "bg-muted text-muted-foreground",
};

function crearFilaVacia(): FilaCosto {
  return {
    _key: crypto.randomUUID(),
    concepto: "",
    proveedor: "",
    moneda: "USD",
    unidad_medida: "",
    costo: 0,
    venta: 0,
    seccion: "Otro",
  };
}

interface Props {
  cotizacionId: string;
  conceptosVenta: ConceptoVentaCotizacion[];
}

export default function SeccionCostosInternosCotizacion({ cotizacionId, conceptosVenta }: Props) {
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const { data: costosGuardados, isLoading } = useCotizacionCostos(cotizacionId);
  const upsert = useUpsertCostos();
  const eliminar = useDeleteCosto();

  const [filas, setFilas] = useState<FilaCosto[]>([]);
  const [inicializado, setInicializado] = useState(false);

  useEffect(() => {
    if (isLoading || inicializado) return;
    if (costosGuardados && costosGuardados.length > 0) {
      setFilas(
        costosGuardados.map((c) => ({
          _key: c.id,
          id: c.id,
          concepto: c.concepto,
          proveedor: c.proveedor ?? "",
          moneda: c.moneda,
          unidad_medida: c.unidad_medida ?? "",
          costo: c.costo,
          venta: c.venta,
          seccion: c.seccion ?? "Otro",
        }))
      );
    } else if (conceptosVenta.length > 0) {
      setFilas(
        conceptosVenta.map((cv) => ({
          _key: crypto.randomUUID(),
          concepto: cv.descripcion,
          proveedor: "",
          moneda: cv.moneda || "USD",
          unidad_medida: "",
          costo: 0,
          venta: cv.precio_unitario * cv.cantidad,
          seccion: "Otro",
        }))
      );
    }
    setInicializado(true);
  }, [isLoading, costosGuardados, conceptosVenta, inicializado]);

  const actualizarFila = (key: string, campo: keyof FilaCosto, valor: string | number) => {
    setFilas((prev) =>
      prev.map((f) => (f._key === key ? { ...f, [campo]: valor } : f))
    );
  };

  const agregarFila = () => setFilas((prev) => [...prev, crearFilaVacia()]);

  const eliminarFila = async (fila: FilaCosto) => {
    if (fila.id) {
      try {
        await eliminar.mutateAsync({ id: fila.id, cotizacionId });
      } catch (err: any) {
        toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
        return;
      }
    }
    setFilas((prev) => prev.filter((f) => f._key !== fila._key));
  };

  const guardar = async () => {
    const costos = filas.map((f) => ({
      ...(f.id ? { id: f.id } : {}),
      cotizacion_id: cotizacionId,
      concepto: f.concepto,
      proveedor: f.proveedor || null,
      moneda: f.moneda,
      unidad_medida: f.unidad_medida || null,
      costo: f.costo,
      venta: f.venta,
      seccion: f.seccion,
    }));
    try {
      const result = await upsert.mutateAsync(costos as any);
      if (result) {
        setFilas((prev) =>
          prev.map((f, i) => ({ ...f, id: (result[i] as any)?.id ?? f.id }))
        );
      }
      toast({ title: "Costos guardados correctamente" });
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    }
  };

  const pl = useMemo(() => {
    const asCostos: CostoCotizacion[] = filas.map((f) => ({
      id: f.id ?? f._key,
      cotizacion_id: cotizacionId,
      concepto: f.concepto,
      proveedor: f.proveedor || null,
      moneda: f.moneda,
      unidad_medida: f.unidad_medida || null,
      costo: f.costo,
      venta: f.venta,
      profit: null,
      porcentaje_profit: null,
      seccion: f.seccion,
    }));
    return calcularPL(asCostos);
  }, [filas, cotizacionId]);

  if (!canEdit) return null;
  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Costos Internos (P&L)
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona costos y analiza la rentabilidad de esta cotización
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={agregarFila}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
          <Button size="sm" onClick={guardar} disabled={upsert.isPending}>
            <Save className="h-4 w-4 mr-1" /> {upsert.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumen KPI */}
        {filas.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard label="Total Costo" value={formatCurrency(pl.totalCosto, "USD")} icon={<Package className="h-4 w-4" />} />
            <KPICard label="Total Venta" value={formatCurrency(pl.totalVenta, "USD")} icon={<DollarSign className="h-4 w-4" />} />
            <KPICard
              label="Utilidad"
              value={formatCurrency(pl.totalProfit, "USD")}
              icon={pl.totalProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              variant={pl.totalProfit >= 0 ? "positive" : "negative"}
            />
            <KPICard
              label="Margen"
              value={`${pl.porcentajeProfit.toFixed(1)}%`}
              icon={pl.porcentajeProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              variant={pl.porcentajeProfit >= 0 ? "positive" : "negative"}
            />
          </div>
        )}

        {/* Filas de costos como cards individuales */}
        <div className="space-y-3">
          {filas.map((fila, idx) => {
            const profit = fila.venta - fila.costo;
            const pctProfit = fila.venta === 0 ? 0 : Math.round((profit / fila.venta) * 10000) / 100;
            return (
              <CostoRow
                key={fila._key}
                fila={fila}
                index={idx}
                profit={profit}
                pctProfit={pctProfit}
                onUpdate={actualizarFila}
                onDelete={() => eliminarFila(fila)}
                isDeleting={eliminar.isPending}
              />
            );
          })}
          {filas.length === 0 && (
            <div className="text-center text-muted-foreground py-10 border border-dashed rounded-lg">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Sin costos registrados</p>
              <p className="text-xs mt-1">Presiona "Agregar" para crear una fila</p>
            </div>
          )}
        </div>

        {/* Desglose por sección */}
        {filas.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Desglose por Sección
            </div>
            <div className="divide-y">
              {SECCIONES.map((sec) => {
                const s = pl.porSeccion[sec];
                if (!s || (s.totalCosto === 0 && s.totalVenta === 0)) return null;
                return (
                  <div key={sec} className="grid grid-cols-4 gap-4 px-4 py-3 text-sm items-center">
                    <Badge variant="outline" className={`${SECCION_COLORS[sec]} w-fit text-xs`}>{sec}</Badge>
                    <span className="text-right tabular-nums">{formatCurrency(s.totalCosto, "USD")}</span>
                    <span className="text-right tabular-nums">{formatCurrency(s.totalVenta, "USD")}</span>
                    <span className={`text-right font-semibold tabular-nums ${s.totalProfit < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {formatCurrency(s.totalProfit, "USD")} ({s.porcentajeProfit.toFixed(1)}%)
                    </span>
                  </div>
                );
              })}
              <div className="grid grid-cols-4 gap-4 px-4 py-3 text-sm items-center font-bold bg-muted/30">
                <span>Total</span>
                <span className="text-right tabular-nums">{formatCurrency(pl.totalCosto, "USD")}</span>
                <span className="text-right tabular-nums">{formatCurrency(pl.totalVenta, "USD")}</span>
                <span className={`text-right tabular-nums ${pl.totalProfit < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {formatCurrency(pl.totalProfit, "USD")} ({pl.porcentajeProfit.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Sub-componentes ── */

function KPICard({ label, value, icon, variant }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: "positive" | "negative";
}) {
  const colorClass = variant === "positive"
    ? "border-l-emerald-500 text-emerald-600 dark:text-emerald-400"
    : variant === "negative"
      ? "border-l-destructive text-destructive"
      : "border-l-primary text-foreground";

  return (
    <div className={`border rounded-lg border-l-4 p-3 ${colorClass}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function CostoRow({ fila, index, profit, pctProfit, onUpdate, onDelete, isDeleting }: {
  fila: FilaCosto;
  index: number;
  profit: number;
  pctProfit: number;
  onUpdate: (key: string, campo: keyof FilaCosto, valor: string | number) => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card hover:shadow-sm transition-shadow">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground w-6 h-6 rounded-full bg-muted flex items-center justify-center">
            {index + 1}
          </span>
          <Badge variant="outline" className={`${SECCION_COLORS[fila.seccion] || SECCION_COLORS["Otro"]} text-xs`}>
            {fila.seccion}
          </Badge>
          {profit !== 0 && (
            <span className={`text-xs font-semibold ${profit < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
              {profit > 0 ? "+" : ""}{formatCurrency(profit, fila.moneda)} ({pctProfit.toFixed(1)}%)
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Fields grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2 md:col-span-1">
          <Label className="text-xs text-muted-foreground">Concepto</Label>
          <Input
            value={fila.concepto}
            onChange={(e) => onUpdate(fila._key, "concepto", e.target.value)}
            placeholder="Ej: Flete marítimo"
            className="h-9 mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Proveedor</Label>
          <Input
            value={fila.proveedor}
            onChange={(e) => onUpdate(fila._key, "proveedor", e.target.value)}
            placeholder="Nombre"
            className="h-9 mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Sección</Label>
          <Select value={fila.seccion} onValueChange={(v) => onUpdate(fila._key, "seccion", v)}>
            <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SECCIONES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Moneda</Label>
          <Select value={fila.moneda} onValueChange={(v) => onUpdate(fila._key, "moneda", v)}>
            <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="MXN">MXN</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Unidad</Label>
          <Input
            value={fila.unidad_medida}
            onChange={(e) => onUpdate(fila._key, "unidad_medida", e.target.value)}
            placeholder="Ej: CBM"
            className="h-9 mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Costo</Label>
          <Input
            type="number"
            value={fila.costo}
            onChange={(e) => onUpdate(fila._key, "costo", Number(e.target.value))}
            className="h-9 mt-1 text-right tabular-nums"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Venta</Label>
          <Input
            type="number"
            value={fila.venta}
            onChange={(e) => onUpdate(fila._key, "venta", Number(e.target.value))}
            className="h-9 mt-1 text-right tabular-nums"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Utilidad</Label>
          <div className={`h-9 mt-1 flex items-center justify-end px-3 rounded-md bg-muted/50 text-sm font-semibold tabular-nums ${profit < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
            {formatCurrency(profit, fila.moneda)}
          </div>
        </div>
      </div>
    </div>
  );
}
