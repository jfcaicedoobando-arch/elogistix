/**
 * FacturaDetalle — vista admin de una factura individual.
 * Reusa los diálogos modales existentes para registrar pagos y se apoya en
 * los hooks `useFactura` / `usePagosFactura`. Sólo lectura para roles
 * no-admin (sin botones de acción).
 */
import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, FileText, FileCode2, Ship, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFactura } from "@/features/facturacion/hooks";
import { usePermissions, useToast } from "@/hooks/shared";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import { formatCurrency } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { openFacturaInNewTab } from "@/services/storage";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { getErrorMessage } from "@/lib/errors";
import { FacturaResumenCard } from "@/features/facturacion/components/detalle/FacturaResumenCard";
import { FacturaConceptosTable } from "@/features/facturacion/components/detalle/FacturaConceptosTable";
import { FacturaPagosSection } from "@/features/facturacion/components/detalle/FacturaPagosSection";
import { FacturaBitacoraCard } from "@/features/facturacion/components/detalle/FacturaBitacoraCard";
import { DialogRegistrarPago } from "@/features/facturacion/components/DialogRegistrarPago";

export default function FacturaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canEdit, isAdmin } = usePermissions();
  const { data: factura, isLoading } = useFactura(id);
  useRegisterBreadcrumbLabel(id, factura?.numero);

  const [pagoOpen, setPagoOpen] = useState(false);

  const handleDownload = async (stored: string, kind: "PDF" | "XML") => {
    try {
      await openFacturaInNewTab(stored);
    } catch (err) {
      notifyError(toast, {
        title: `No se pudo abrir el ${kind}`,
        description: getErrorMessage(err),
        method: "ON_ERROR",
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!factura) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Factura no encontrada o sin acceso.</p>
        <Button variant="link" onClick={() => navigate("/facturacion")}>
          Volver a facturación
        </Button>
      </div>
    );
  }

  const vencida = factura.estado === "Vencida";

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-6xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/facturacion")} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold font-mono tabular-nums">{factura.numero}</h1>
            <Badge className={`${getEstadoColor(factura.estado)} text-xs`}>{factura.estado}</Badge>
            {vencida && <AlertTriangle className="h-4 w-4 text-destructive" />}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {factura.cliente_nombre} • Exp: <span className="font-mono">{factura.expediente}</span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-bold tabular-nums text-accent">
            {formatCurrency(Number(factura.total), factura.moneda)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {factura.factura_pdf_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload(factura.factura_pdf_url!, "PDF")}
          >
            <FileText className="h-4 w-4 mr-1.5 text-destructive" /> Descargar PDF
          </Button>
        )}
        {factura.factura_xml_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload(factura.factura_xml_url!, "XML")}
          >
            <FileCode2 className="h-4 w-4 mr-1.5 text-info" /> Descargar XML
          </Button>
        )}
        {factura.embarque_id && (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/embarques/${factura.embarque_id}`}>
              <Ship className="h-4 w-4 mr-1.5" /> Ver embarque
            </Link>
          </Button>
        )}
      </div>

      <FacturaResumenCard factura={factura} />
      <FacturaConceptosTable snapshot={factura.snapshot_emision} moneda={factura.moneda} />
      <FacturaPagosSection
        facturaId={factura.id}
        facturaNumero={factura.numero}
        totalFactura={Number(factura.total)}
        moneda={factura.moneda}
        canEdit={canEdit}
        onRegistrarPago={() => setPagoOpen(true)}
      />
      {isAdmin && <FacturaBitacoraCard facturaId={factura.id} />}

      <DialogRegistrarPago
        open={pagoOpen}
        onOpenChange={setPagoOpen}
        factura={{
          id: factura.id,
          numero: factura.numero,
          total: Number(factura.total),
          moneda: factura.moneda,
        }}
      />
    </div>
  );
}
