import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DetailSkeleton } from "@/components/shared/skeletons";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { FileText, FileCode2, Ship, AlertTriangle, Receipt } from "lucide-react";

import { usePortalFactura } from "@/features/portal/hooks";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import { formatCurrency } from "@/lib/formatters";
import { ROUTES } from "@/constants/routes";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { openFacturaInNewTab } from "@/services/storage";
import PortalFacturaResumenCard from "@/features/portal/components/factura/PortalFacturaResumenCard";
import PortalFacturaConceptosTable from "@/features/portal/components/factura/PortalFacturaConceptosTable";
import PortalFacturaPagosCard from "@/features/portal/components/factura/PortalFacturaPagosCard";

import { notifyError } from "@/lib/ui/appFeedback";
export default function PortalFacturaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: factura, isLoading } = usePortalFactura(id);
  useRegisterBreadcrumbLabel(id, factura?.numero);

  const handleDownload = async (stored: string, kind: "PDF" | "XML") => {
    try {
      await openFacturaInNewTab(stored);
    } catch (err) {
      notifyError(undefined, { title: `No se pudo abrir el ${kind}`,
        description: (err as Error).message, error: err, method: "PAGES_PORTAL_PORTALFACTURADETALLE_1" });
    }
  };

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (!factura) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Factura no encontrada.</p>
        <Button variant="link" onClick={() => navigate(ROUTES.PORTAL_FACTURAS)}>
          Volver a facturas
        </Button>
      </div>
    );
  }

  const vencida = factura.estado === "Vencida";

  return (
    <div className="space-y-5">
      <DetailHeader
        backTo={ROUTES.PORTAL_FACTURAS}
        backLabel="Volver a Facturas"
        icon={<Receipt className="h-6 w-6 text-accent shrink-0" />}
        title={<span className="font-mono tabular-nums">{factura.numero}</span>}
        subtitle={
          <>
            {factura.cliente_nombre} • Exp: <span className="font-mono">{factura.expediente}</span>
          </>
        }
        badge={
          <>
            <Badge className={`${getEstadoColor(factura.estado)} text-xs`}>{factura.estado}</Badge>
            {vencida && <AlertTriangle className="h-4 w-4 text-destructive" />}
          </>
        }
        trailing={
          <div className="text-right shrink-0">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold tabular-nums text-accent">
              {formatCurrency(factura.total, factura.moneda)}
            </p>
          </div>
        }
      />



      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
        {factura.factura_pdf_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload(factura.factura_pdf_url!, "PDF")}
            className="col-span-1 sm:flex-initial"
          >
            <FileText className="h-4 w-4 mr-1.5 text-destructive" /> Descargar PDF
          </Button>
        )}
        {factura.factura_xml_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload(factura.factura_xml_url!, "XML")}
            className="col-span-1 sm:flex-initial"
          >
            <FileCode2 className="h-4 w-4 mr-1.5 text-info" /> Descargar XML
          </Button>
        )}
        {factura.embarque_id && (
          <Button variant="outline" size="sm" asChild className="col-span-2 sm:col-span-1 sm:flex-initial">
            <Link to={`/portal/embarques/${factura.embarque_id}`}>
              <Ship className="h-4 w-4 mr-1.5" /> Ver embarque
            </Link>
          </Button>
        )}
      </div>

      <PortalFacturaResumenCard factura={factura} />

      <PortalFacturaConceptosTable snapshot={factura.snapshot_emision} moneda={factura.moneda} />

      <PortalFacturaPagosCard
        facturaId={factura.id}
        totalFactura={Number(factura.total)}
        moneda={factura.moneda}
      />
    </div>
  );
}
