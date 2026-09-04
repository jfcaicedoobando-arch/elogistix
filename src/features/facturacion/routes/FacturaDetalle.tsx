/**
 * FacturaDetalle — vista admin de una factura individual. Si la URL trae
 * `?accion=timbrar` (llegada desde conversión de proforma) abre el diálogo
 * de timbrado automáticamente.
 */
import { useParams } from "react-router-dom";
import { DetailNotFound } from "@/components/shared/DetailNotFound";
import { FileX } from "lucide-react";
import { DetailSkeleton } from "@/components/shared/skeletons";
import { PageContainer } from "@/components/shared/PageContainer";

import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import { useDocumentTitle } from "@/hooks/shared";

import { useAutoAbrirTimbrar } from "@/features/facturacion/hooks/useAutoAbrirTimbrar";
import { useVolverAFacturaOriginal } from "@/features/facturacion/hooks/useVolverAFacturaOriginal";
import { useFacturaDetalleDialogs } from "@/features/facturacion/hooks/useFacturaDetalleDialogs";
import { useFacturaDetalleController } from "@/features/facturacion/hooks/useFacturaDetalleController";
import { FacturaDetalleView } from "@/features/facturacion/components/detalle/FacturaDetalleView";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { getErrorMessage } from "@/lib/errors";
import { esUuid } from "@/lib/esUuid";


function FacturaNoEncontrada() {
  return (
    <DetailNotFound
      icon={FileX}
      title="Factura no encontrada"
      description="La factura no existe, fue eliminada o no tienes acceso a ella."
      backTo="/facturacion"
      backLabel="Volver a Facturación"
      withContainer={false}
    />
  );
}


export default function FacturaDetalle() {
  const { id } = useParams<{ id: string }>();
  const idValido = esUuid(id);
  const controller = useFacturaDetalleController(idValido ? id : undefined);
  const { canEdit, factura, isLoading, error, refetch, flags } = controller;
  useRegisterBreadcrumbLabel(id, factura?.numero);
  // UIA-12: título de pestaña por folio de factura.
  useDocumentTitle(factura?.numero ? `Factura ${factura.numero}` : "Factura");

  const dialogs = useFacturaDetalleDialogs();
  const { puedeTimbrarDesdeSistema } = flags;
  useAutoAbrirTimbrar(puedeTimbrarDesdeSistema, canEdit, () => dialogs.setTimbrarOpen(true));
  const sustituyeA = (factura as { sustituye_a?: string | null } | null | undefined)?.sustituye_a ?? null;
  const { href: volverHref, label: volverLabel } = useVolverAFacturaOriginal(id, sustituyeA);

  // Segmento de URL que no es un UUID (p. ej. `/facturacion/estado-cuenta`):
  // evitamos el 400 de la base y el esqueleto infinito.
  if (!idValido) return <FacturaNoEncontrada />;


  if (isLoading) {
    return (
      <PageContainer>
        <DetailSkeleton />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <ErrorStateInline
          message={getErrorMessage(error)}
          onRetry={() => void refetch()}
        />
      </PageContainer>
    );
  }

  if (!factura) return <FacturaNoEncontrada />;

  return (
    <FacturaDetalleView
      factura={factura}
      canEdit={canEdit}
      flags={flags}
      acuse={controller.acuse}
      eliminando={controller.eliminando}
      conceptosVivos={controller.conceptosVivos}
      pagoRepPendiente={controller.pagoRepPendiente}
      timbrarRep={controller.timbrarRep}
      handleDownload={controller.handleDownload}
      onEliminar={() => controller.eliminar(factura.id)}
      volverHref={volverHref}
      volverLabel={volverLabel}
      dialogs={dialogs}
      saldo={controller.saldo}
      saldoError={controller.saldoError}
      onRetrySaldo={controller.refetchSaldo}
    />
  );
}
