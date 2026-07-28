import { useParams, useNavigate } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailSkeleton } from "@/components/shared/skeletons";
import { usePortalCotizacion } from "@/features/portal/hooks";
import SeccionMercanciaCotizacionDetalle from "@/features/cotizacion/components/SeccionMercanciaCotizacionDetalle";
import TablaConceptosGenerico from "@/features/cotizacion/components/TablaConceptosGenerico";
import ResumenTotalesCotizacion from "@/features/cotizacion/components/ResumenTotalesCotizacion";
import { usePortalCotizacionDetalle } from "@/features/cotizacion/hooks";
import { usePortalCotizacionDetalleController } from "@/features/cotizacion/hooks";
import PortalCotizacionHeader from "@/features/portal/components/cotizacion/PortalCotizacionHeader";
import PortalCotizacionEstadoBanner from "@/features/portal/components/cotizacion/PortalCotizacionEstadoBanner";
import PortalCotizacionConfirmDialog from "@/features/portal/components/cotizacion/PortalCotizacionConfirmDialog";
import DatosGeneralesCard from "@/features/portal/components/cotizacion/DatosGeneralesCard";

import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";

export default function PortalCotizacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: cot, isLoading } = usePortalCotizacion(id);
  useRegisterBreadcrumbLabel(id, cot?.folio);
  const totales = usePortalCotizacionDetalle(cot);
  const {
    confirmAction,
    setConfirmAction,
    comentario,
    setComentario,
    handleResponder,
    onDialogOpenChange,
    isPending,
  } = usePortalCotizacionDetalleController(id);

  if (isLoading) {
    return <DetailSkeleton sections={1} />;
  }

  if (!cot) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Cotización no encontrada.</p>
        <Button variant="link" onClick={() => navigate(ROUTES.PORTAL_COTIZACIONES)}>
          Volver a cotizaciones
        </Button>
      </div>
    );
  }

  const { conceptosUSD, conceptosMXN, totalUSD, subtotalMXN, ivaMXN, totalMXN } = totales;
  // cast: comentario_cliente vive en la fila DB pero no en el tipo dominio mínimo
  const comentarioCliente = (cot as { comentario_cliente?: string | null }).comentario_cliente;

  return (
    <div className="space-y-6">
      <PortalCotizacionHeader
        folio={cot.folio}
        estado={cot.estado}
        clienteNombre={cot.cliente_nombre}
        
        onAceptar={() => setConfirmAction("Aceptada")}
        onRechazar={() => setConfirmAction("Rechazada")}
      />

      <PortalCotizacionEstadoBanner
        estado={cot.estado}
        comentarioCliente={comentarioCliente}
        embarqueId={(cot as { embarque_id?: string | null }).embarque_id ?? null}
        embarqueExpediente={(cot as { embarque_expediente?: string | null }).embarque_expediente ?? null}
        fechaAceptacion={(cot as { fecha_aceptacion?: string | null }).fecha_aceptacion ?? null}
        fechaRechazo={(cot as { fecha_rechazo?: string | null }).fecha_rechazo ?? null}
      />

      <DatosGeneralesCard cot={cot} />


      <SeccionMercanciaCotizacionDetalle cotizacion={cot} />

      {conceptosUSD.length > 0 && (
        <TablaConceptosGenerico moneda="USD" conceptos={conceptosUSD} total={totalUSD} />
      )}

      {conceptosMXN.length > 0 && (
        <TablaConceptosGenerico
          moneda="MXN"
          conceptos={conceptosMXN}
          subtotal={subtotalMXN}
          iva={ivaMXN}
          total={totalMXN}
        />
      )}

      <ResumenTotalesCotizacion totalUSD={totalUSD} totalMXN={totalMXN} />

      {cot.notas && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{cot.notas}</p>
          </CardContent>
        </Card>
      )}

      <PortalCotizacionConfirmDialog
        confirmAction={confirmAction}
        comentario={comentario}
        isPending={isPending}
        onCommentChange={setComentario}
        onOpenChange={onDialogOpenChange}
        onConfirm={handleResponder}
      />
    </div>
  );
}
