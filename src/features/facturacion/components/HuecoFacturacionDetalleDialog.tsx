/**
 * Diálogo de detalle del "Hueco de Facturación":
 * tabla de embarques pendientes + descarga CSV.
 *
 * v13.152.1: migrado a `FormDialogShell` (Ola 3, Lote A).
 */
import { AlertTriangle, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { DataTable } from "@/components/shared/DataTable";
import { formatCurrency } from "@/lib/formatters";
import { huecoFacturacionColumns } from "./huecoFacturacionColumns";
import type { FilaHueco } from "@/features/facturacion/services";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filas: FilaHueco[];
  totalEmbarques: number;
  totalUsd: number;
  totalMxn: number;
  isLoading: boolean;
  onExportCsv: () => void;
}

export function HuecoFacturacionDetalleDialog({
  open,
  onOpenChange,
  filas,
  totalEmbarques,
  totalUsd,
  totalMxn,
  isLoading,
  onExportCsv,
}: Props) {
  const navigate = useNavigate();

  const footer = (
    <>
      <Button variant="outline" onClick={onExportCsv} disabled={filas.length === 0}>
        <Download className="h-4 w-4 mr-1.5" />
        Descargar CSV
      </Button>
      <Button variant="outline" onClick={() => onOpenChange(false)}>
        Cerrar
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={AlertTriangle}
      title={`Hueco de Facturación — ${totalEmbarques} embarques`}
      description={
        <>
          ETD desde 1/abr/2026, más de 5 días sin emitir factura al cliente. Total pendiente:{" "}
          <strong>{formatCurrency(totalUsd, "USD")}</strong> ·{" "}
          <strong>{formatCurrency(totalMxn, "MXN")}</strong>
        </>
      }
      size="4xl"
      footer={footer}
    >
      <DataTable
        columns={huecoFacturacionColumns}
        data={filas}
        isLoading={isLoading}
        rowKey={(f) => f.embarque_id}
        density="comfortable"
        emptyMessage="Sin embarques en hueco de facturación"
        onRowClick={(f) => {
          onOpenChange(false);
          navigate(`/embarques/${f.embarque_id}`);
        }}
      />
    </FormDialogShell>
  );
}
