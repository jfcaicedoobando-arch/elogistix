/**
 * Tarjeta fija (independiente del selector de mes) que destaca el "Hueco de
 * Facturación": embarques con ETD > 5 días sin factura con PDF.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { fetchHuecoFacturacion } from "@/services/facturas/huecoFacturacion";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export function HuecoFacturacionCard() {
  const { organizationId } = useOrgFilter();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["facturacion", "hueco", organizationId],
    queryFn: () => fetchHuecoFacturacion(organizationId ?? null),
    staleTime: 60_000,
  });

  const total = data?.totalEmbarques ?? 0;
  const sinHueco = !isLoading && total === 0;

  return (
    <>
      <Card
        className={cn(
          "border-2 overflow-hidden",
          sinHueco
            ? "border-success/40 bg-success/5"
            : "border-destructive/50 bg-destructive/5",
        )}
      >
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div
              className={cn(
                "rounded-xl p-3 shrink-0",
                sinHueco ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
              )}
            >
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 mb-1">
                <h3
                  className={cn(
                    "text-sm font-bold tracking-wide uppercase",
                    sinHueco ? "text-success" : "text-destructive",
                  )}
                >
                  🚨 Hueco de Facturación
                </h3>
                <Badge variant="outline" className="text-[10px] font-mono">
                  ETD &gt; 5 días sin factura
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Embarques donde el proveedor ya facturó pero todavía no facturas al cliente.
              </p>
            </div>

            <div className="flex items-center gap-6 flex-wrap">
              <div className="text-center">
                <div className="text-3xl font-bold tabular-nums leading-none">
                  {isLoading ? "—" : total}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">Embarques</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold tabular-nums">
                  {isLoading ? "—" : formatCurrency(data?.totalUsd ?? 0, "USD")}
                </div>
                <div className="text-[11px] text-muted-foreground">USD sin facturar</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold tabular-nums">
                  {isLoading ? "—" : formatCurrency(data?.totalMxn ?? 0, "MXN")}
                </div>
                <div className="text-[11px] text-muted-foreground">MXN sin facturar</div>
              </div>
              <Button
                variant={sinHueco ? "outline" : "destructive"}
                size="sm"
                onClick={() => setOpen(true)}
                disabled={total === 0}
              >
                Ver detalle <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Hueco de Facturación · {total} embarque{total === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription>
              Embarques con ETD hace más de 5 días que aún no tienen factura con PDF adjunto.
              Total: {formatCurrency(data?.totalUsd ?? 0, "USD")} ·{" "}
              {formatCurrency(data?.totalMxn ?? 0, "MXN")}.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-3">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 px-2 font-medium">Expediente</th>
                  <th className="text-left py-2 px-2 font-medium">Cliente</th>
                  <th className="text-left py-2 px-2 font-medium">Operador</th>
                  <th className="text-left py-2 px-2 font-medium">ETD</th>
                  <th className="text-right py-2 px-2 font-medium">Días</th>
                  <th className="text-right py-2 px-2 font-medium">Venta USD</th>
                  <th className="text-right py-2 px-2 font-medium">Venta MXN</th>
                </tr>
              </thead>
              <tbody>
                {data?.filas.map((f) => (
                  <tr
                    key={f.embarque_id}
                    className="border-b hover:bg-muted/40 cursor-pointer"
                    onClick={() => {
                      setOpen(false);
                      navigate(`/embarques/${f.embarque_id}`);
                    }}
                  >
                    <td className="py-2 px-2 font-mono font-medium">{f.expediente}</td>
                    <td className="py-2 px-2 truncate max-w-[200px]" title={toTitleCase(f.cliente_nombre)}>
                      {toTitleCase(f.cliente_nombre)}
                    </td>
                    <td className="py-2 px-2 text-xs">{f.operador || "—"}</td>
                    <td className="py-2 px-2 text-xs whitespace-nowrap">
                      {f.etd ? formatDate(f.etd) : "—"}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-mono text-[11px]",
                          f.diasDesdeEtd > 30
                            ? "border-destructive/50 bg-destructive/10 text-destructive"
                            : f.diasDesdeEtd > 15
                              ? "border-warning/50 bg-warning/10 text-warning"
                              : "border-muted-foreground/30 text-muted-foreground",
                        )}
                      >
                        {f.diasDesdeEtd}d
                      </Badge>
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {formatCurrency(f.ventaUsd, "USD")}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-medium">
                      {formatCurrency(f.ventaMxn, "MXN")}
                    </td>
                  </tr>
                ))}
                {data && data.filas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      Sin embarques en hueco. ¡Todo facturado a tiempo!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
