/**
 * FacturaProveedorDetalle — página de detalle de una factura recibida.
 * v13.349.0: sustituye al modal `DialogDetallePagosProveedor`; comparte el
 * lenguaje visual del detalle de factura emitida (encabezado + stepper,
 * cinta de KPIs, pestañas enlazables y riel de historial).
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileX } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { DetailSkeleton } from "@/components/shared/skeletons";
import { DetailNotFound } from "@/components/shared/DetailNotFound";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DocumentoLayout } from "@/components/shared/documento/DocumentoLayout";
import { DocumentoKpiStrip } from "@/components/shared/documento/DocumentoKpiStrip";
import { getErrorMessage } from "@/lib/errors";
import { usePermissions, useDocumentTitle } from "@/hooks/shared";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import {
  usePagosProveedor,
  useEliminarPagoProveedor,
  useEliminarFacturaProveedor,
} from "@/features/cxp/hooks";
import { useFacturaProveedor } from "@/features/cxp/hooks/useFacturaProveedor";
import { useCerrarFacturaProveedorSinPago } from "@/features/cxp/hooks/useCerrarFacturaSinPago";
import { useCancelarFacturaProveedor } from "@/features/cxp/hooks/useCancelarFacturaProveedor";
import { computeFacturaFlags } from "@/features/cxp/components/DialogDetallePagosProveedor.flags";
import { StatusActionBar } from "@/features/cxp/components/DialogDetallePagosProveedor.actionbar";
import { HistorialFacturaSection } from "@/features/cxp/components/HistorialFacturaSection";
import { FacturaProveedorHeader } from "@/features/cxp/components/detalle/FacturaProveedorHeader";
import { FacturaProveedorTabs } from "@/features/cxp/components/detalle/FacturaProveedorTabs";
import { FacturaProveedorDialogs } from "@/features/cxp/components/detalle/FacturaProveedorDialogs";
import { buildKpisFacturaProveedor } from "@/features/cxp/domain/facturaProveedorKpis";
import type { FacturaCxP } from "@/features/cxp/services";

export default function FacturaProveedorDetalle() {
  useDocumentTitle("Factura de proveedor");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit, canAprobarFacturaProveedor } = usePermissions();

  const facturaQ = useFacturaProveedor(id);
  const f = facturaQ.data ?? null;
  const pagosQ = usePagosProveedor(id);
  const pagos = pagosQ.data ?? [];
  useRegisterBreadcrumbLabel(id, f?.folio_interno);

  const eliminarPago = useEliminarPagoProveedor(id ?? "");
  const eliminarFactura = useEliminarFacturaProveedor();
  const cerrarSinPago = useCerrarFacturaProveedorSinPago();
  const cancelar = useCancelarFacturaProveedor();

  const [pagarOpen, setPagarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [eliminarOpen, setEliminarOpen] = useState(false);
  const [pagoAEliminar, setPagoAEliminar] = useState<string | null>(null);
  const [aCerrarSinPago, setACerrarSinPago] = useState<FacturaCxP | null>(null);
  const [openCancel, setOpenCancel] = useState(false);

  if (facturaQ.isLoading) {
    return (
      <PageContainer>
        <DetailSkeleton />
      </PageContainer>
    );
  }

  if (facturaQ.error) {
    return (
      <PageContainer>
        <ErrorStateInline
          title="No pudimos cargar el detalle de la factura"
          message={getErrorMessage(facturaQ.error)}
          onRetry={() => void facturaQ.refetch()}
          retrying={facturaQ.isFetching}
        />
      </PageContainer>
    );
  }

  if (!f) {
    return (
      <DetailNotFound
        icon={FileX}
        title="Factura de proveedor no encontrada"
        description="La factura no existe, fue eliminada o no tienes acceso a ella."
        backTo="/compras/facturas"
        backLabel="Volver a Facturas de proveedor"
        withContainer={false}
      />
    );
  }

  const flags = computeFacturaFlags(f, canEdit);

  return (
    <TooltipProvider delayDuration={150}>
      <PageContainer>
        <FacturaProveedorHeader
          factura={f}
          actions={
            <StatusActionBar
              factura={f}
              canEdit={canEdit}
              puedeAprobar={canAprobarFacturaProveedor}
              flags={flags}
              onPagar={() => setPagarOpen(true)}
              onEditar={() => setEditarOpen(true)}
              onEliminar={() => setEliminarOpen(true)}
              onCerrarSinPago={setACerrarSinPago}
              onCancelar={() => setOpenCancel(true)}
            />
          }
        />

        <DocumentoKpiStrip kpis={buildKpisFacturaProveedor(f)} />

        <DocumentoLayout rail={<HistorialFacturaSection facturaId={f.id} />}>
          <FacturaProveedorTabs
            factura={f}
            pagos={pagos}
            pagosLoading={pagosQ.isLoading}
            canEdit={canEdit}
            onEliminarPago={setPagoAEliminar}
          />
        </DocumentoLayout>

        <FacturaProveedorDialogs
          factura={f}
          pagarOpen={pagarOpen}
          setPagarOpen={setPagarOpen}
          editarOpen={editarOpen}
          setEditarOpen={setEditarOpen}
          eliminarOpen={eliminarOpen}
          setEliminarOpen={setEliminarOpen}
          eliminando={eliminarFactura.isPending}
          onConfirmEliminar={async () => {
            try {
              await eliminarFactura.mutateAsync(f.id);
              navigate("/compras/facturas");
            } catch {
              /* el hook ya notifica */
            }
          }}
          acciones={{
            pagoAEliminar, setPagoAEliminar, eliminar: eliminarPago,
            aCerrarSinPago, setACerrarSinPago, cerrarSinPago,
            openCancel, setOpenCancel, cancelar,
          }}
        />
      </PageContainer>
    </TooltipProvider>
  );
}
