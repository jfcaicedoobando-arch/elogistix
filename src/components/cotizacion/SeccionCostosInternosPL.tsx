import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DollarSign, Banknote, TrendingUp, ChevronDown, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import {
  useCotizacionCostos, useUpsertCotizacionCostos, CostoCotizacion,
} from "@/hooks/useCotizacionCostos";
import type { ConceptoVentaCotizacion } from "@/hooks/useCotizaciones";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  cotizacionId: string;
  conceptosUSD: ConceptoVentaCotizacion[];
  conceptosMXN: ConceptoVentaCotizacion[];
}

interface FilaCosto {
  concepto: string;
  moneda: "USD" | "MXN";
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  // readonly from concepto de venta
  venta: number;
  aplica_iva?: boolean;
}

function profitBadge(profit: number) {
  if (profit > 0) return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{profit.toFixed(1)}%</Badge>;
  if (profit < 0) return <Badge className="bg-red-100 text-red-700 border-red-200">{profit.toFixed(1)}%</Badge>;
  return <Badge variant="secondary">0%</Badge>;
}

export default function SeccionCostosInternosPL({ cotizacionId, conceptosUSD, conceptosMXN }: Props) {
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const { data: costosGuardados, isLoading } = useCotizacionCostos(cotizacionId);
  const upsert = useUpsertCotizacionCostos();

  const [filas, setFilas] = useState<FilaCosto[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Initialize from saved costs or pre-populate from conceptos de venta
  useEffect(() => {
    if (isLoading || initialized) return;

    if (costosGuardados && costosGuardados.length > 0) {
      // Map saved costs back, matching venta from conceptos
      const mapped: FilaCosto[] = costosGuardados.map((c) => {
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
        return {
          concepto: c.concepto,
          moneda: c.moneda as "USD" | "MXN",
          proveedor: c.proveedor,
          cantidad: c.cantidad,
          costo_unitario: c.costo_unitario,
          venta,
          aplica_iva,
        };
      });
      setFilas(mapped);
    } else {
      // Pre-populate from conceptos de venta
      const fromUSD: FilaCosto[] = conceptosUSD.map((c) => ({
        concepto: c.descripcion,
        moneda: "USD" as const,
        proveedor: "",
        cantidad: c.cantidad,
        costo_unitario: 0,
        venta: c.cantidad * c.precio_unitario,
        aplica_iva: c.aplica_iva ?? false,
      }));
      const fromMXN: FilaCosto[] = conceptosMXN.map((c) => ({
        concepto: c.descripcion,
        moneda: "MXN" as const,
        proveedor: "",
        cantidad: c.cantidad,
        costo_unitario: 0,
        venta: c.cantidad * c.precio_unitario,
      }));
      setFilas([...fromUSD, ...fromMXN]);
    }
    setInitialized(true);
  }, [isLoading, costosGuardados, conceptosUSD, conceptosMXN, initialized]);

  const filasUSD = useMemo(() => filas.filter((f) => f.moneda === "USD"), [filas]);
  const filasMXN = useMemo(() => filas.filter((f) => f.moneda === "MXN"), [filas]);

  const updateFila = (index: number, field: "proveedor" | "costo_unitario", value: string) => {
    setFilas((prev) => {
      const copy = [...prev];
      if (field === "costo_unitario") {
        copy[index] = { ...copy[index], costo_unitario: parseFloat(value) || 0 };
      } else {
        copy[index] = { ...copy[index], [field]: value };
      }
      return copy;
    });
  };

  const getGlobalIndex = (moneda: "USD" | "MXN", localIndex: number) => {
    let count = 0;
    for (let i = 0; i < filas.length; i++) {
      if (filas[i].moneda === moneda) {
        if (count === localIndex) return i;
        count++;
      }
    }
    return -1;
  };

  // Totals
  const totalesUSD = useMemo(() => {
    const totalCosto = filasUSD.reduce((s, f) => s + f.cantidad * f.costo_unitario, 0);
    const totalVenta = filasUSD.reduce((s, f) => s + f.venta, 0);
    const profit = totalVenta - totalCosto;
    const pct = totalVenta !== 0 ? (profit / totalVenta) * 100 : 0;
    return { totalCosto, totalVenta, profit, pct };
  }, [filasUSD]);

  const totalesMXN = useMemo(() => {
    const totalCosto = filasMXN.reduce((s, f) => s + f.cantidad * f.costo_unitario, 0);
    const subtotalVenta = filasMXN.reduce((s, f) => s + f.venta, 0);
    const profit = subtotalVenta - totalCosto;
    const pct = subtotalVenta !== 0 ? (profit / subtotalVenta) * 100 : 0;
    const iva = subtotalVenta * 0.16;
    return { totalCosto, subtotalVenta, profit, pct, iva, totalConIva: subtotalVenta + iva };
  }, [filasMXN]);

  const handleGuardar = async () => {
    const costos: CostoCotizacion[] = filas.map((f) => ({
      id: "",
      cotizacion_id: cotizacionId,
      concepto: f.concepto,
      moneda: f.moneda,
      proveedor: f.proveedor,
      cantidad: f.cantidad,
      costo_unitario: f.costo_unitario,
      costo_total: f.cantidad * f.costo_unitario,
      created_at: "",
      updated_at: "",
    }));

    try {
      await upsert.mutateAsync({ cotizacionId, costos });
      toast({ title: "Costos guardados correctamente" });
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) return null;

  const renderTable = (
    rows: FilaCosto[],
    moneda: "USD" | "MXN",
    title: string,
    icon: React.ReactNode,
  ) => {
    if (rows.length === 0) return null;

    const totCosto = rows.reduce((s, f) => s + f.cantidad * f.costo_unitario, 0);
    const totVenta = rows.reduce((s, f) => s + f.venta, 0);
    const totProfit = totVenta - totCosto;
    const totPct = totVenta !== 0 ? (totProfit / totVenta) * 100 : 0;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
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
                  const profit = fila.venta - costo;
                  const pct = fila.venta !== 0 ? (profit / fila.venta) * 100 : 0;
                  const globalIdx = getGlobalIndex(moneda, idx);

                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium text-sm">{fila.concepto}</TableCell>
                      <TableCell>
                        {canEdit ? (
                          <Input
                            value={fila.proveedor}
                            onChange={(e) => updateFila(globalIdx, "proveedor", e.target.value)}
                            className="h-8 text-sm"
                            placeholder="Proveedor"
                          />
                        ) : (
                          <span className="text-sm">{fila.proveedor || "-"}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit ? (
                          <Input
                            type="number"
                            value={fila.costo_unitario || ""}
                            onChange={(e) => updateFila(globalIdx, "costo_unitario", e.target.value)}
                            className="h-8 text-sm text-right w-28 ml-auto"
                            min={0}
                            step={0.01}
                          />
                        ) : (
                          <span className="text-sm">{formatCurrency(fila.costo_unitario, moneda)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(fila.venta, moneda)}
                        {fila.aplica_iva && <span className="text-xs text-muted-foreground ml-1">+ IVA</span>}
                      </TableCell>
                      <TableCell className={`text-right text-sm font-medium ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {formatCurrency(profit, moneda)}
                      </TableCell>
                      <TableCell className="text-right">{profitBadge(pct)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell colSpan={2}>Totales</TableCell>
                  <TableCell className="text-right">{formatCurrency(totCosto, moneda)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totVenta, moneda)}</TableCell>
                  <TableCell className={`text-right ${totProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(totProfit, moneda)}
                  </TableCell>
                  <TableCell className="text-right">{profitBadge(totPct)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {moneda === "MXN" && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-muted-foreground">* P&L calculado sobre subtotales sin IVA</p>
              <div className="flex flex-col items-end gap-0.5 text-sm">
                <span>Subtotal s/IVA: {formatCurrency(totalesMXN.subtotalVenta, "MXN")}</span>
                <span>IVA 16%: {formatCurrency(totalesMXN.iva, "MXN")}</span>
                <span className="font-bold">Total c/IVA: {formatCurrency(totalesMXN.totalConIva, "MXN")}</span>
              </div>
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

      {/* Resumen P&L */}
      {(filasUSD.length > 0 || filasMXN.length > 0) && (
        <Collapsible defaultOpen>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-violet-500" />
                  Resumen P&L
                  <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
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
                        <div className="flex justify-center pt-1">
                          {profitBadge(totalesUSD.pct)}
                        </div>
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
                          <span>{formatCurrency(totalesMXN.subtotalVenta, "MXN")}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold">
                          <span>Profit</span>
                          <span className={totalesMXN.profit >= 0 ? "text-emerald-600" : "text-red-600"}>
                            {formatCurrency(totalesMXN.profit, "MXN")}
                          </span>
                        </div>
                        <div className="flex justify-center pt-1">
                          {profitBadge(totalesMXN.pct)}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-3">* El IVA no forma parte del profit</p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Botón Guardar */}
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
