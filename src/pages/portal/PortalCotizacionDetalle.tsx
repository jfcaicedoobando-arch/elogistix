import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortalCotizacion } from "@/hooks/portal/usePortalData";
import SeccionMercanciaCotizacionDetalle from "@/components/cotizacion/SeccionMercanciaCotizacionDetalle";
import TablaConceptosGenerico from "@/components/cotizacion/TablaConceptosGenerico";
import ResumenTotalesCotizacion from "@/components/cotizacion/ResumenTotalesCotizacion";
import { usePortalCotizacionDetalle } from "@/hooks/cotizacion/usePortalCotizacionDetalle";
import { usePortalCotizacionDetalleController } from "@/hooks/cotizacion/usePortalCotizacionDetalleController";
import PortalCotizacionHeader from "@/components/portal/cotizacion/PortalCotizacionHeader";
import PortalCotizacionEstadoBanner from "@/components/portal/cotizacion/PortalCotizacionEstadoBanner";
import PortalCotizacionConfirmDialog from "@/components/portal/cotizacion/PortalCotizacionConfirmDialog";
import { formatDate } from "@/lib/formatters";
import type { Tables } from "@/types/db";
import { useRegisterBreadcrumbLabel } from "@/contexts/BreadcrumbContext";

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
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!cot) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Cotización no encontrada.</p>
        <Button variant="link" onClick={() => navigate("/portal/cotizaciones")}>
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
        onBack={() => navigate("/portal/cotizaciones")}
        onAceptar={() => setConfirmAction("Aceptada")}
        onRechazar={() => setConfirmAction("Rechazada")}
      />

      <PortalCotizacionEstadoBanner
        estado={cot.estado}
        comentarioCliente={comentarioCliente}
        embarqueId={(cot as { embarque_id?: string | null }).embarque_id ?? null}
        embarqueExpediente={(cot as { embarque_expediente?: string | null }).embarque_expediente ?? null}
      />

      {/* Datos generales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos Generales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Modo</span>
              <p className="font-medium">{cot.modo}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Tipo</span>
              <p className="font-medium">{cot.tipo}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Incoterm</span>
              <p className="font-medium">{cot.incoterm}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Moneda</span>
              <p className="font-medium">{cot.moneda}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Origen</span>
              <p className="font-medium">{cot.origen || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Destino</span>
              <p className="font-medium">{cot.destino || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Vigencia</span>
              <p className="font-medium">{cot.fecha_vigencia ? formatDate(cot.fecha_vigencia) : "—"}</p>
            </div>
            {cot.tiempo_transito_dias != null && (
              <div>
                <span className="text-muted-foreground">Tiempo de Tránsito</span>
                <p className="font-medium">{cot.tiempo_transito_dias} días</p>
              </div>
            )}
            {cot.ruta_texto && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Ruta</span>
                <p className="font-medium">{cot.ruta_texto}</p>
              </div>
            )}
            {cot.frecuencia && (
              <div>
                <span className="text-muted-foreground">Frecuencia</span>
                <p className="font-medium">{cot.frecuencia}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
