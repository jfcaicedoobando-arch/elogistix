/**
 * Cuerpo principal de `CotizacionDetalle`: banners, secciones de datos,
 * conceptos y tarjetas relacionadas. Extraído para bajar la complejidad
 * ciclomática de la ruta.
 */
import { EnviarCotizacionDialog } from "@/features/cotizacion/components/detalle/EnviarCotizacionDialog";
import { HistorialEnviosCard } from "@/features/cotizacion/components/detalle/HistorialEnviosCard";
import SeccionCostosInternosPLUnificado from "@/features/cotizacion/components/SeccionCostosInternosPLUnificado";
import TablaConceptosGenerico from "@/features/cotizacion/components/TablaConceptosGenerico";
import ResumenTotalesCotizacion from "@/features/cotizacion/components/ResumenTotalesCotizacion";
import DialogConvertirProspecto from "@/features/cotizacion/components/DialogConvertirProspecto";
import SeccionMercanciaCotizacionDetalle from "@/features/cotizacion/components/SeccionMercanciaCotizacionDetalle";
import { CotizacionDetalleEmbarques, CotizacionDetalleAcciones } from "@/features/cotizacion/components/CotizacionDetalleSecciones";
import { CotizacionDatosGeneralesCard } from "@/features/cotizacion/components/detalle/CotizacionDatosGeneralesCard";
import { VersionesCotizacionCard } from "@/features/cotizacion/components/detalle/VersionesCotizacionCard";
import { CotizacionInactivaBanner } from "@/features/cotizacion/components/detalle/CotizacionInactivaBanner";
import { CotizacionSinOportunidadBanner } from "@/features/cotizacion/components/detalle/CotizacionSinOportunidadBanner";
import { ProspectoBanner, ComentarioClienteCard, NotasCard } from "@/features/cotizacion/routes/detalle/CotizacionDetalleCards";
import { ReaprobacionTarifaBanner } from "@/features/cotizacion/components/revalidacion/ReaprobacionTarifaBanner";
import { SinDesgloseBanner } from "@/features/cotizacion/components/SinDesgloseBanner";
import { AvisoConceptosDescartados } from "@/features/cotizacion/components/AvisoConceptosDescartados";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useClienteAutorizacion } from "@/features/cliente/hooks/useClienteAutorizacion";
import type { CotizacionDetalleContenidoProps as Props } from "./cotizacionDetalleContenido.types";

/** Renderiza el cuerpo de la vista de detalle (todo lo que va bajo el header). */
export function CotizacionDetalleContenido({
  cotizacion, id, canEdit, effectiveRole, embarquesVinculados, envios,
  totales, dialogos, acciones,
}: Props) {

  const {
    tasaIva, conceptosVentaUSD, conceptosVentaMXN,
    totalUSD, subtotalMXN, ivaMXN, totalMXN, conceptosDescartados,
  } = totales;
  const { showConvertir, setShowConvertir, enviarOpen, setEnviarOpen } = dialogos;
  const {
    clienteForm, setClienteForm, handleCambiarEstado,
    abrirDialogConvertir, handleConvertir, convertirProspecto, navigate,
  } = acciones;
  const { user } = useAuth();
  const { autorizacion } = useClienteAutorizacion(
    (cotizacion as { cliente_id?: string | null }).cliente_id ?? null,
  );
  return (
    <>
      <CotizacionInactivaBanner
        cotizacionId={cotizacion.id}
        estado={cotizacion.estado}
        updatedAt={cotizacion.updated_at}
        canEdit={canEdit}
      />

      <ReaprobacionTarifaBanner
        cotizacionId={cotizacion.id}
        estado={(cotizacion as { estado_revalidacion?: string }).estado_revalidacion}
        deltaJsonb={(cotizacion as { revalidacion_delta_jsonb?: unknown }).revalidacion_delta_jsonb}
      />

      {cotizacion.sin_desglose_costos && (
        <SinDesgloseBanner onCargarCostos={() => navigate(`/cotizaciones/${cotizacion.id}/editar`)} />
      )}

      {canEdit && (
        <CotizacionDetalleAcciones
          estado={cotizacion.estado}
          esProspecto={cotizacion.es_prospecto}
          numContenedores={cotizacion.num_contenedores}
          cotizacionId={id}
          version={(cotizacion as { version?: number }).version ?? 1}
          tieneEmbarquesVinculados={embarquesVinculados.length > 0 || !!cotizacion.embarque_id}
          onCambiarEstado={handleCambiarEstado}
          onAbrirConvertir={abrirDialogConvertir}
          total={totalUSD + totalMXN}
          rol={effectiveRole}
          creadaPor={(cotizacion as { created_by?: string | null }).created_by ?? null}
          usuarioActual={user?.id ?? null}
          requiereAutorizacionCliente={autorizacion.requiereAutorizacionCotizacion}
        />
      )}

      {cotizacion.es_prospecto && !cotizacion.oportunidad_id && (
        <CotizacionSinOportunidadBanner
          cotizacionId={cotizacion.id}
          folio={cotizacion.folio}
          modoTransporte={(cotizacion as { modo?: string | null }).modo ?? null}
          empresa={cotizacion.prospecto_empresa}
          contacto={cotizacion.prospecto_contacto}
          email={cotizacion.prospecto_email}
          telefono={cotizacion.prospecto_telefono}
          canEdit={canEdit}
        />
      )}

      {cotizacion.es_prospecto && (
        <ProspectoBanner
          empresa={cotizacion.prospecto_empresa}
          contacto={cotizacion.prospecto_contacto}
          email={cotizacion.prospecto_email}
          telefono={cotizacion.prospecto_telefono}
        />
      )}

      <CotizacionDatosGeneralesCard cotizacion={cotizacion} />
      <SeccionMercanciaCotizacionDetalle cotizacion={cotizacion} />

      <AvisoConceptosDescartados
        descartados={conceptosDescartados}
        conceptosValidos={conceptosVentaUSD.length + conceptosVentaMXN.length}
      />

      <TablaConceptosGenerico moneda="USD" conceptos={conceptosVentaUSD} total={totalUSD} />
      <TablaConceptosGenerico moneda="MXN" conceptos={conceptosVentaMXN} subtotal={subtotalMXN} iva={ivaMXN} total={totalMXN} />
      <ResumenTotalesCotizacion totalUSD={totalUSD} totalMXN={totalMXN} />

      {canEdit && (
        <SeccionCostosInternosPLUnificado
          tipo="detalle"
          cotizacionId={cotizacion.id}
          conceptosUSD={conceptosVentaUSD}
          conceptosMXN={conceptosVentaMXN}
        />
      )}

      {cotizacion.comentario_cliente && <ComentarioClienteCard texto={cotizacion.comentario_cliente} />}
      {cotizacion.notas && <NotasCard texto={cotizacion.notas} />}

      <CotizacionDetalleEmbarques
        embarques={embarquesVinculados}
        cotizacionEstado={cotizacion.estado}
      />

      <HistorialEnviosCard envios={envios} />

      <VersionesCotizacionCard cotizacionId={cotizacion.id} />

      <DialogConvertirProspecto
        open={showConvertir}
        onOpenChange={setShowConvertir}
        clienteForm={clienteForm}
        setClienteForm={setClienteForm}
        onConvertir={handleConvertir}
        isPending={convertirProspecto.isPending}
      />

      <EnviarCotizacionDialog
        open={enviarOpen}
        onOpenChange={setEnviarOpen}
        cotizacion={cotizacion}
        totalMxn={totalMXN}
        totalUsd={totalUSD}
        tasaIva={tasaIva}
        envioPrevio={envios[0]}
      />
    </>
  );
}
