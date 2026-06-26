/**
 * FacturaDetalle — vista admin de una factura individual.
 * Reusa los diálogos modales existentes para registrar pagos y se apoya en
 * los hooks `useFactura` / `usePagosFactura`. Sólo lectura para roles
 * no-admin (sin botones de acción).
 *
 * Fase 4 (Proforma → Factura): si la URL trae `?accion=timbrar` (por ejemplo
 * tras convertir una proforma) se abre automáticamente `DialogTimbrarFactura`
 * para invitar al usuario a continuar el flujo.
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFactura } from "@/features/facturacion/hooks";
import { usePermissions, useToast } from "@/hooks/shared";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import { formatCurrency } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { openFacturaInNewTab } from "@/services/storage";
import { descargarCfdiFacturapi, esUrlFacturapi } from "@/features/facturacion/services/descargarCfdiFacturapi";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { getErrorMessage } from "@/lib/errors/index";
import { FacturaResumenCard } from "@/features/facturacion/components/detalle/FacturaResumenCard";
import { FacturaConceptosTable } from "@/features/facturacion/components/detalle/FacturaConceptosTable";
import { FacturaPagosSection } from "@/features/facturacion/components/detalle/FacturaPagosSection";
import { FacturaBitacoraCard } from "@/features/facturacion/components/detalle/FacturaBitacoraCard";
import { DialogRegistrarPago } from "@/features/facturacion/components/DialogRegistrarPago";
import { DialogTimbrarFactura } from "@/features/facturacion/components/DialogTimbrarFactura";
import { DialogEnviarCfdi } from "@/features/facturacion/components/DialogEnviarCfdi";
import { FacturaDetalleActions } from "@/features/facturacion/components/detalle/FacturaDetalleActions";
import { FacturaNotasCreditoSeccion } from "@/features/facturacion/components/detalle/FacturaNotasCreditoSeccion";
import { DialogSustituirFactura } from "@/features/facturacion/components/DialogSustituirFactura";
import { Replace } from "lucide-react";


export default function FacturaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { canEdit, isAdmin } = usePermissions();
  const { data: factura, isLoading } = useFactura(id);
  useRegisterBreadcrumbLabel(id, factura?.numero);

  const [pagoOpen, setPagoOpen] = useState(false);
  const [timbrarOpen, setTimbrarOpen] = useState(false);
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [sustituirOpen, setSustituirOpen] = useState(false);

  const sinTimbrar = !!factura && !factura.uuid_fiscal;


  // Auto-abrir el diálogo de timbrado cuando llegamos desde la conversión de
  // proforma (`?accion=timbrar`). Sólo si la factura todavía no está timbrada.
  useEffect(() => {
    if (searchParams.get("accion") === "timbrar" && sinTimbrar && canEdit) {
      setTimbrarOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("accion");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, sinTimbrar, canEdit, setSearchParams]);

  const handleDownload = async (stored: string | null, tipo: "pdf" | "xml") => {
    try {
      const usarProxy = !stored || esUrlFacturapi(stored);
      if (usarProxy && factura?.id) {
        await descargarCfdiFacturapi({ tipo, facturaId: factura.id });
      } else if (stored) {
        await openFacturaInNewTab(stored);
      }
    } catch (err) {
      notifyError(toast, {
        title: `No se pudo abrir el ${tipo.toUpperCase()}`,
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
            {sinTimbrar && <Badge variant="outline" className="text-xs">Sin timbrar</Badge>}
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

      <FacturaDetalleActions
        canEdit={canEdit}
        sinTimbrar={sinTimbrar}
        pdfUrl={factura.factura_pdf_url}
        xmlUrl={factura.factura_xml_url}
        embarqueId={factura.embarque_id ?? null}
        onTimbrar={() => setTimbrarOpen(true)}
        onEnviarEmail={() => setEnviarOpen(true)}
        onDownload={handleDownload}
      />

      {canEdit && !sinTimbrar && factura.estado === "Emitida" && (
        <Button variant="outline" size="sm" onClick={() => setSustituirOpen(true)} className="gap-1">
          <Replace className="h-4 w-4" /> Sustituir CFDI (motivo 01)
        </Button>
      )}




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
      <FacturaNotasCreditoSeccion
        facturaId={factura.id}
        facturaNumero={factura.numero}
        monedaFactura={factura.moneda}
        tipoCambioFactura={Number(factura.tipo_cambio ?? 1)}
        saldoFactura={Number(factura.total)}
        uuidFacturaOriginal={factura.uuid_fiscal ?? null}
        snapshotEmision={factura.snapshot_emision}
        canEdit={canEdit}
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
          metodoPago: factura.metodo_pago ?? null,
          uuidFiscal: factura.uuid_fiscal ?? null,
        }}
      />

      <DialogTimbrarFactura
        facturaId={timbrarOpen ? factura.id : null}
        open={timbrarOpen}
        onOpenChange={setTimbrarOpen}
      />

      <DialogEnviarCfdi
        open={enviarOpen}
        onOpenChange={setEnviarOpen}
        facturaId={factura.id}
        titulo={`Enviar CFDI ${factura.numero}`}
      />

      <DialogSustituirFactura
        facturaId={sustituirOpen ? factura.id : null}
        numero={factura.numero}
        uuidOriginal={factura.uuid_fiscal ?? null}
        open={sustituirOpen}
        onOpenChange={setSustituirOpen}
      />

    </div>
  );
}
