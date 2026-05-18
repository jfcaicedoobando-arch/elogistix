/**
 * Diálogo de detalle del "Hueco de Facturación":
 * tabla de embarques pendientes + descarga CSV.
 */
import { AlertTriangle, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/shared/DataTable";
import { formatCurrency } from "@/lib/formatters";
import { huecoFacturacionColumns } from "./huecoFacturacionColumns";
import type { FilaHueco } from "@/services/facturas";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Hueco de Facturación — {totalEmbarques} embarques
          </DialogTitle>
          <DialogDescription>
            ETD desde 1/abr/2026, más de 5 días sin emitir factura al cliente. Total pendiente:{" "}
            <strong>{formatCurrency(totalUsd, "USD")}</strong> ·{" "}
            <strong>{formatCurrency(totalMxn, "MXN")}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto -mx-6 px-6">
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
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onExportCsv} disabled={filas.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />
            Descargar CSV
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
