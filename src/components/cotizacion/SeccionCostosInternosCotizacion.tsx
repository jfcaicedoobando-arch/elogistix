import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import {
  useCotizacionCostos, useUpsertCostos, useDeleteCosto, calcularPL,
  type CostoCotizacion,
} from "@/hooks/useCotizacionCostos";
import type { ConceptoVentaCotizacion } from "@/hooks/useCotizaciones";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save } from "lucide-react";
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

  // Inicializar filas: desde BD o pre-poblar desde conceptosVenta
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
      // Sync ids back
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

  // Calcular P&L desde filas locales
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Costos Internos (P&L)</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={agregarFila}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
          <Button size="sm" onClick={guardar} disabled={upsert.isPending}>
            <Save className="h-4 w-4 mr-1" /> {upsert.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Concepto</TableHead>
                <TableHead className="min-w-[120px]">Proveedor</TableHead>
                <TableHead className="w-[90px]">Moneda</TableHead>
                <TableHead className="w-[90px]">Unidad</TableHead>
                <TableHead className="w-[100px] text-right">Costo</TableHead>
                <TableHead className="w-[100px] text-right">Venta</TableHead>
                <TableHead className="w-[100px] text-right">Profit</TableHead>
                <TableHead className="w-[80px] text-right">%</TableHead>
                <TableHead className="w-[140px]">Sección</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((fila) => {
                const profit = fila.venta - fila.costo;
                const pctProfit = fila.venta === 0 ? 0 : Math.round((profit / fila.venta) * 10000) / 100;
                return (
                  <TableRow key={fila._key}>
                    <TableCell>
                      <Input
                        value={fila.concepto}
                        onChange={(e) => actualizarFila(fila._key, "concepto", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={fila.proveedor}
                        onChange={(e) => actualizarFila(fila._key, "proveedor", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={fila.moneda} onValueChange={(v) => actualizarFila(fila._key, "moneda", v)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="MXN">MXN</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={fila.unidad_medida}
                        onChange={(e) => actualizarFila(fila._key, "unidad_medida", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={fila.costo}
                        onChange={(e) => actualizarFila(fila._key, "costo", Number(e.target.value))}
                        className="h-8 text-sm text-right"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={fila.venta}
                        onChange={(e) => actualizarFila(fila._key, "venta", Number(e.target.value))}
                        className="h-8 text-sm text-right"
                      />
                    </TableCell>
                    <TableCell className={`text-right text-sm font-medium ${profit < 0 ? "text-destructive" : "text-emerald-600"}`}>
                      {formatCurrency(profit, fila.moneda)}
                    </TableCell>
                    <TableCell className={`text-right text-sm ${pctProfit < 0 ? "text-destructive" : ""}`}>
                      {pctProfit.toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Select value={fila.seccion} onValueChange={(v) => actualizarFila(fila._key, "seccion", v)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SECCIONES.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => eliminarFila(fila)}
                        disabled={eliminar.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-6">
                    Sin costos. Presiona "Agregar" para crear una fila.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Resumen P&L */}
        {filas.length > 0 && (
          <div className="mt-4 border rounded-md p-4 bg-muted/30 space-y-2 text-sm">
            <div className="grid grid-cols-4 gap-4 font-semibold border-b pb-2">
              <span>Sección</span>
              <span className="text-right">Costo</span>
              <span className="text-right">Venta</span>
              <span className="text-right">Profit (%)</span>
            </div>
            {SECCIONES.map((sec) => {
              const s = pl.porSeccion[sec];
              if (!s || (s.totalCosto === 0 && s.totalVenta === 0)) return null;
              return (
                <div key={sec} className="grid grid-cols-4 gap-4">
                  <span>{sec}</span>
                  <span className="text-right">{formatCurrency(s.totalCosto, "USD")}</span>
                  <span className="text-right">{formatCurrency(s.totalVenta, "USD")}</span>
                  <span className={`text-right font-medium ${s.totalProfit < 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {formatCurrency(s.totalProfit, "USD")} ({s.porcentajeProfit.toFixed(1)}%)
                  </span>
                </div>
              );
            })}
            <div className="grid grid-cols-4 gap-4 font-bold border-t pt-2">
              <span>Total</span>
              <span className="text-right">{formatCurrency(pl.totalCosto, "USD")}</span>
              <span className="text-right">{formatCurrency(pl.totalVenta, "USD")}</span>
              <span className={`text-right ${pl.totalProfit < 0 ? "text-destructive" : "text-emerald-600"}`}>
                {formatCurrency(pl.totalProfit, "USD")} ({pl.porcentajeProfit.toFixed(1)}%)
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
