/**
 * Bandeja "Por facturar" (hueco de facturación): embarques cerrados
 * sin CFDI. Reusa la tabla que ya vivía en `HuecoFacturacionDetalleDialog`.
 */
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { formatCurrency } from "@/lib/formatters";
import { useHuecoFacturacion } from "@/features/facturacion/hooks";
import { huecoFacturacionColumns } from "@/features/facturacion/components/huecoFacturacionColumns";

export function BandejaPorFacturar() {
  const { filas, isLoading, totalEmbarques, totalUsd, totalMxn, exportarCsv } =
    useHuecoFacturacion();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{totalEmbarques}</span>{" "}
          embarque(s) cerrado(s) sin CFDI ·{" "}
          <span className="tabular-nums">{formatCurrency(totalUsd, "USD")}</span> ·{" "}
          <span className="tabular-nums">{formatCurrency(totalMxn, "MXN")}</span>
        </div>
        <Button size="sm" variant="outline" onClick={exportarCsv} disabled={filas.length === 0}>
          <Download className="h-4 w-4 mr-2" /> CSV
        </Button>
      </div>
      <DataTable
        columns={huecoFacturacionColumns}
        data={filas}
        isLoading={isLoading}
        emptyMessage="No hay hueco de facturación. ✅"
        rowKey={(row) => row.embarque_id}
        getRowHref={(row) => `/embarques/${row.embarque_id}?tab=facturacion`}
        getRowAriaLabel={(row) => `Abrir embarque ${row.expediente ?? row.embarque_id}`}
      />

    </div>
  );
}
