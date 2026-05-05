import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { fetchHuecoFacturacion, type FilaHueco } from "@/services/facturas/huecoFacturacion";
import { exportToCsv } from "@/generators/exportCsv";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { cn } from "@/lib/utils";

/**
 * Tarjeta fija "Hueco de Facturación":
 * embarques con ETD > 5 días sin factura emitida.
 * Indicador global, NO depende del selector de mes.
 */
export function HuecoFacturacionCard() {
  const { organizationId } = useOrgFilter();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["facturacion", "hueco", organizationId],
    queryFn: () => fetchHuecoFacturacion({ organizationId: organizationId ?? null }),
    staleTime: 60_000,
  });

  const totalEmbarques = data?.totalEmbarques ?? 0;
  const totalUsd = data?.totalUsd ?? 0;
  const totalMxn = data?.totalMxn ?? 0;

  const columns: DataTableColumn<FilaHueco>[] = useMemo(() => [
    {
      key: "expediente", header: "Expediente", width: "w-[120px]", sticky: true,
      className: "font-mono font-medium whitespace-nowrap",
      sortable: true, sortValue: (f) => f.expediente,
      render: (f) => f.expediente || "—",
    },
    {
      key: "cliente", header: "Cliente", width: "min-w-[180px]", className: "max-w-[260px] truncate",
      sortable: true, sortValue: (f) => f.cliente_nombre,
      render: (f) => <span title={toTitleCase(f.cliente_nombre)}>{toTitleCase(f.cliente_nombre)}</span>,
    },
    {
      key: "operador", header: "Operador", width: "w-[140px]", className: "truncate text-sm",
      sortable: true, sortValue: (f) => f.operador,
      render: (f) => f.operador || <span className="text-muted-foreground">—</span>,
    },
    {
      key: "etd", header: "ETD", width: "w-[100px]", className: "text-xs whitespace-nowrap",
      sortable: true, sortValue: (f) => f.etd,
      render: (f) => formatDate(f.etd),
    },
    {
      key: "bl", header: "BL", width: "w-[160px]", className: "font-mono text-xs whitespace-nowrap",
      sortable: true, sortValue: (f) => f.bl_master ?? f.bl_house ?? "",
      render: (f) => {
        const m = f.bl_master?.trim();
        const h = f.bl_house?.trim();
        if (!m && !h) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex flex-col leading-tight">
            {m && <span title={`Master: ${m}`}>{m}</span>}
            {h && <span className="text-muted-foreground" title={`House: ${h}`}>H: {h}</span>}
          </div>
        );
      },
    },
    {
      key: "dias", header: "Días sin facturar", width: "w-[140px]", align: "center",
      sortable: true, sortValue: (f) => f.diasDesdeEtd,
      render: (f) => {
        const d = f.diasDesdeEtd;
        const tone = d > 30 ? "destructive" : d > 15 ? "warning" : "default";
        return (
          <Badge
            variant={tone === "default" ? "outline" : "outline"}
            className={cn(
              "tabular-nums font-semibold",
              tone === "destructive" && "bg-destructive/10 text-destructive border-destructive/30",
              tone === "warning" && "bg-warning/10 text-warning border-warning/30",
              tone === "default" && "bg-muted text-foreground",
            )}
          >
            {d} días
          </Badge>
        );
      },
    },
    {
      key: "venta_usd", header: "Venta USD", width: "w-[130px]", align: "right",
      className: "tabular-nums whitespace-nowrap",
      sortable: true, sortValue: (f) => f.ventaUsd,
      render: (f) => formatCurrency(f.ventaUsd, "USD"),
    },
    {
      key: "venta_mxn", header: "Venta MXN", width: "w-[140px]", align: "right",
      className: "tabular-nums whitespace-nowrap font-medium",
      sortable: true, sortValue: (f) => f.ventaMxn,
      render: (f) => formatCurrency(f.ventaMxn, "MXN"),
    },
  ], []);

  // Si está cargando o no hay hueco, no mostramos la alerta (silenciar cuando todo OK).
  if (!isLoading && totalEmbarques === 0) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-4 flex items-center gap-3">
        <div className="rounded-lg bg-success/15 p-2">
          <AlertTriangle className="h-4 w-4 text-success" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-success">Sin hueco de facturación</p>
          <p className="text-xs text-muted-foreground">
            Todos los embarques con ETD &gt; 5 días desde el 1/abr/2026 están facturados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative rounded-xl border-2 border-destructive/40 bg-destructive/5 overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-destructive" />
        <div className="p-5 pl-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="rounded-lg bg-destructive/15 p-2.5 shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>

            <div className="flex-1 min-w-[220px]">
              <h3 className="text-sm font-bold tracking-wide uppercase text-destructive">
                ⚠ Hueco de Facturación
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Embarques con ETD &gt; 5 días (proveedor ya facturó) y sin factura emitida al cliente.
                <span className="ml-1 italic">Indicador global, no depende del mes seleccionado.</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold tabular-nums text-destructive leading-none">
                  {isLoading ? "…" : totalEmbarques}
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wide mt-1">
                  Embarques
                </div>
              </div>
              <div className="h-10 w-px bg-destructive/20" />
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Sin facturar USD</div>
                <div className="text-lg font-semibold tabular-nums text-destructive">
                  {formatCurrency(totalUsd, "USD")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Sin facturar MXN</div>
                <div className="text-lg font-semibold tabular-nums text-destructive">
                  {formatCurrency(totalMxn, "MXN")}
                </div>
              </div>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => setOpen(true)}
                disabled={totalEmbarques === 0}
              >
                <Eye className="h-4 w-4 mr-1.5" />
                Ver detalle
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Hueco de Facturación — {totalEmbarques} embarques
            </DialogTitle>
            <DialogDescription>
              ETD desde 1/abr/2026, más de 5 días sin emitir factura al cliente.
              Total pendiente: <strong>{formatCurrency(totalUsd, "USD")}</strong> ·{" "}
              <strong>{formatCurrency(totalMxn, "MXN")}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto -mx-6 px-6">
            <DataTable
              columns={columns}
              data={data?.filas ?? []}
              isLoading={isLoading}
              rowKey={(f) => f.embarque_id}
              density="comfortable"
              emptyMessage="Sin embarques en hueco de facturación"
              onRowClick={(f) => {
                setOpen(false);
                navigate(`/embarques/${f.embarque_id}`);
              }}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
