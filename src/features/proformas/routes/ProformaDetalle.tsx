/**
 * ProformaDetalle — página dedicada de una proforma individual.
 * Drilldown desde el tab Facturación del embarque y del módulo Facturación.
 * Layout de 2 columnas: contenido principal (conceptos + factura + notas) y
 * barra lateral de contexto (datos generales, cliente, embarque, historial).
 */
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { LoadingState } from "@/components/shared/states/LoadingState";
import { DetailNotFound } from "@/components/shared/DetailNotFound";
import { FileX } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import { useProformaDetalle } from "@/features/proformas/hooks/useProformaDetalle";
import { useDescargarProformaPdf } from "@/features/embarques/hooks/useDescargarProformaPdf";
import { useTasaIVA } from "@/features/catalogos/hooks/useTasaIVA";
import { calcularTotalesProforma } from "@/features/proformas/domain/proforma";
import { resolveProformaTimelineFields } from "@/features/proformas/domain/proformaClienteEstado";
import {
  AccionesProforma,
  FacturaAsociadaCard,
  NotasCard,
} from "@/features/proformas/components/ProformaDetalleCards";
import { ClienteBillToCard } from "@/features/proformas/components/detalle/ClienteBillToCard";
import { EmbarqueDatosCard } from "@/features/proformas/components/detalle/EmbarqueDatosCard";
import { ProformaDatosGeneralesCard } from "@/features/proformas/components/detalle/ProformaDatosGeneralesCard";
import { ProformaConceptosCard } from "@/features/proformas/components/detalle/ProformaConceptosCard";
import { ProformaBitacoraCard } from "@/features/proformas/components/detalle/ProformaBitacoraCard";
import { TimelineProforma } from "@/features/proformas/components/detalle/TimelineProforma";
import { ProformaDetalleHeader } from "@/features/proformas/components/detalle/ProformaDetalleHeader";

export default function ProformaDetalle() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useProformaDetalle(id);
  useRegisterBreadcrumbLabel(id, data?.proforma.numero);

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState label="Cargando proforma…" />
      </PageContainer>
    );
  }

  if (!data) {
    return (
      <DetailNotFound
        icon={FileX}
        title="Proforma no encontrada"
        description="La proforma no existe, fue eliminada o no tienes acceso a ella."
        backTo="/proformas"
        backLabel="Volver a Proformas"
      />
    );
  }

  return <ProformaDetalleContent data={data} />;
}

interface ContentProps {
  data: NonNullable<ReturnType<typeof useProformaDetalle>["data"]>;
}

function ProformaDetalleContent({ data }: ContentProps) {
  const { descargar, downloadingId } = useDescargarProformaPdf();
  const tasaIva = useTasaIVA();
  const totales = useMemo(
    () => calcularTotalesProforma(data.conceptos, tasaIva),
    [data, tasaIva],
  );

  const { proforma, conceptos } = data;
  const timeline = resolveProformaTimelineFields(proforma);
  const facturas = proforma.facturas_asociadas ?? [];
  const clienteFull = proforma.cliente_full ?? null;
  const embarqueFull = proforma.embarque_full ?? null;
  const mostrarEmbarque = !!embarqueFull && !proforma.es_consolidada;
  const emptyConceptos = proforma.es_consolidada
    ? "Proforma consolidada (ver detalle agregado en el PDF)."
    : "Sin conceptos.";

  return (
    <PageContainer>
      <ProformaDetalleHeader
        numero={proforma.numero}
        estadoProforma={proforma.estado_proforma}
        estadoCliente={timeline.estadoCliente}
        aceptadaPor={timeline.aceptadaPor}
        clienteNombre={proforma.cliente_nombre}
        expediente={proforma.expediente}
        totales={totales}
        actions={
          <AccionesProforma
            proforma={proforma}
            downloadingId={downloadingId}
            onDescargar={() => descargar(proforma)}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 space-y-4">
          <ProformaConceptosCard
            conceptos={conceptos}
            totales={totales}
            emptyMessage={emptyConceptos}
          />
          {facturas.length > 0 && <FacturaAsociadaCard facturas={facturas} />}
          <NotasCard notas={proforma.notas} />
        </div>

        <aside className="space-y-4">
          <ProformaDatosGeneralesCard
            fechaEmision={proforma.fecha_emision}
            diasCredito={proforma.dias_credito}
            diasCreditoCliente={clienteFull?.dias_credito}
            folioFacturaExterna={proforma.folio_factura_externa}
            blMaster={proforma.bl_master}
          />
          <ClienteBillToCard
            cliente={clienteFull}
            clienteNombreFallback={proforma.cliente_nombre}
            clienteId={proforma.cliente_id}
          />
          {mostrarEmbarque && (
            <EmbarqueDatosCard
              embarque={embarqueFull}
              embarqueId={proforma.embarque_id}
              expediente={proforma.expediente}
            />
          )}
          <TimelineProforma
            fechaEmision={proforma.fecha_emision}
            operador={proforma.operador}
            timeline={timeline}
            envios={proforma.envios}
          />
          <ProformaBitacoraCard proformaId={proforma.id} />
        </aside>
      </div>
    </PageContainer>
  );
}
