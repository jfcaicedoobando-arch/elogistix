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
import { ArrowLeft, Replace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFactura } from "@/features/facturacion/hooks";
import { useDescargarCfdi } from "@/features/facturacion/hooks/useDescargarCfdi";
import { usePermissions } from "@/hooks/shared";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import { FacturaResumenCard } from "@/features/facturacion/components/detalle/FacturaResumenCard";
import { FacturaConceptosTable } from "@/features/facturacion/components/detalle/FacturaConceptosTable";
import { FacturaConceptosEditor } from "@/features/facturacion/components/detalle/FacturaConceptosEditor";
import { FacturaDatosFiscalesCard } from "@/features/facturacion/components/detalle/FacturaDatosFiscalesCard";
import { useConceptosFactura } from "@/features/facturacion/hooks/useConceptosFactura";
import { FacturaPagosSection } from "@/features/facturacion/components/detalle/FacturaPagosSection";
import { FacturaBitacoraCard } from "@/features/facturacion/components/detalle/FacturaBitacoraCard";
import { FacturaDetalleActions } from "@/features/facturacion/components/detalle/FacturaDetalleActions";
import { FacturaNotasCreditoSeccion } from "@/features/facturacion/components/detalle/FacturaNotasCreditoSeccion";
import { FacturaDetalleHeader } from "@/features/facturacion/components/detalle/FacturaDetalleHeader";
import { FacturaDetalleModales } from "@/features/facturacion/components/detalle/FacturaDetalleModales";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { useEliminarBorradorFactura } from "@/features/facturacion/hooks/useEliminarBorradorFactura";
import { FacturaFiscalCheckAlert } from "@/features/facturacion/components/detalle/FacturaFiscalCheckAlert";
import { PageContainer } from "@/components/shared/PageContainer";

function canDeleteBorrador(
  factura: { estado?: string | null; facturapi_id?: string | null } | null | undefined,
  canEdit: boolean,
): boolean {
  return !!factura && factura.estado === "Borrador" && !factura.facturapi_id && canEdit;
}


export default function FacturaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canEdit, isAdmin } = usePermissions();
  const { data: factura, isLoading } = useFactura(id);
  useRegisterBreadcrumbLabel(id, factura?.numero);

  const [pagoOpen, setPagoOpen] = useState(false);
  const [timbrarOpen, setTimbrarOpen] = useState(false);
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [sustituirOpen, setSustituirOpen] = useState(false);
  const [eliminarOpen, setEliminarOpen] = useState(false);

  const sinTimbrar = !!factura && !factura.uuid_fiscal;
  const esBorrador = factura?.estado === "Borrador" && !factura?.facturapi_id;
  const puedeEditarBorrador = !!esBorrador && canEdit;
  const puedeEliminarBorrador = canDeleteBorrador(factura, canEdit);
  const handleDownload = useDescargarCfdi(factura?.id);
  const { eliminar, isPending: eliminando } = useEliminarBorradorFactura();
  const { data: conceptosVivos = [] } = useConceptosFactura(factura?.id);


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


  if (isLoading) {
    return (
      <PageContainer>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </PageContainer>
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

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate("/facturacion")} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Button>

      <FacturaDetalleHeader
        numero={factura.numero}
        estado={factura.estado}
        sinTimbrar={sinTimbrar}
        clienteNombre={factura.cliente_nombre}
        expediente={factura.expediente}
        total={Number(factura.total)}
        moneda={factura.moneda}
      />

      {factura.cliente_id && (
        <FacturaFiscalCheckAlert clienteId={factura.cliente_id} estado={factura.estado} />
      )}


      <FacturaDetalleActions
        canEdit={canEdit}
        sinTimbrar={sinTimbrar}
        pdfUrl={factura.factura_pdf_url}
        xmlUrl={factura.factura_xml_url}
        embarqueId={factura.embarque_id ?? null}
        onTimbrar={() => setTimbrarOpen(true)}
        onEnviarEmail={() => setEnviarOpen(true)}
        onDownload={handleDownload}
        onEliminarBorrador={puedeEliminarBorrador ? () => setEliminarOpen(true) : undefined}
        eliminando={eliminando}
      />

      {canEdit && !sinTimbrar && factura.estado === "Emitida" && (
        <Button variant="outline" size="sm" onClick={() => setSustituirOpen(true)} className="gap-1">
          <Replace className="h-4 w-4" /> Sustituir CFDI (motivo 01)
        </Button>
      )}

      <FacturaResumenCard factura={factura} />

      {puedeEditarBorrador && <FacturaDatosFiscalesCard factura={factura} />}

      <FacturaConceptosTable
        snapshot={factura.snapshot_emision}
        moneda={factura.moneda}
        conceptos={conceptosVivos}
      />

      {puedeEditarBorrador && (
        <FacturaConceptosEditor
          facturaId={factura.id}
          organizationId={factura.organization_id}
          moneda={factura.moneda}
          conceptos={conceptosVivos}
        />
      )}
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

      <FacturaDetalleModales
        factura={factura}
        pagoOpen={pagoOpen} setPagoOpen={setPagoOpen}
        timbrarOpen={timbrarOpen} setTimbrarOpen={setTimbrarOpen}
        enviarOpen={enviarOpen} setEnviarOpen={setEnviarOpen}
        sustituirOpen={sustituirOpen} setSustituirOpen={setSustituirOpen}
      />

      <DoubleConfirmDeleteDialog
        open={eliminarOpen}
        onOpenChange={setEliminarOpen}
        entityName={`borrador ${factura.numero}`}
        description="Se eliminará el borrador de factura y la proforma volverá a estar disponible para convertir. Sólo se pueden eliminar borradores sin timbrar."
        finalDescription="Esta acción es irreversible: se borran conceptos, la factura borrador y se revierte la proforma."
        isPending={eliminando}
        onConfirm={() => eliminar(factura.id)}
      />
    </PageContainer>
  );
}
