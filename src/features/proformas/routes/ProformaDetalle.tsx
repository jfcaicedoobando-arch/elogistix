/**
 * ProformaDetalle — página dedicada de una proforma individual.
 * Drilldown desde el tab Facturación del embarque y del módulo Facturación.
 */
import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { LoadingState } from "@/components/shared/states/LoadingState";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
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
  TotalesCard,
} from "@/features/proformas/components/ProformaDetalleCards";
import { ClienteBillToCard } from "@/features/proformas/components/detalle/ClienteBillToCard";
import { EmbarqueDatosCard } from "@/features/proformas/components/detalle/EmbarqueDatosCard";
import { ProformaDatosGeneralesCard } from "@/features/proformas/components/detalle/ProformaDatosGeneralesCard";
import { TimelineProforma } from "@/features/proformas/components/detalle/TimelineProforma";
import { ProformaDetalleHeader } from "@/features/proformas/components/detalle/ProformaDetalleHeader";
import { conceptoColumns } from "@/features/proformas/components/detalle/conceptoColumns";

export default function ProformaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
  const gridClass = mostrarEmbarque ? "grid gap-4 md:grid-cols-2" : "grid gap-4 md:grid-cols-1";
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
      />

      <AccionesProforma
        proforma={proforma}
        downloadingId={downloadingId}
        onDescargar={() => descargar(proforma)}
      />

      <ProformaDatosGeneralesCard
        fechaEmision={proforma.fecha_emision}
        diasCredito={proforma.dias_credito}
        folioFacturaExterna={proforma.folio_factura_externa}
        operador={proforma.operador}
        blMaster={proforma.bl_master}
      />

      <div className={gridClass}>
        <ClienteBillToCard cliente={clienteFull} clienteNombreFallback={proforma.cliente_nombre} />
        {mostrarEmbarque && <EmbarqueDatosCard embarque={embarqueFull} />}
      </div>

      <TimelineProforma
        fechaEmision={proforma.fecha_emision}
        operador={proforma.operador}
        timeline={timeline}
      />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Conceptos</CardTitle></CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={conceptoColumns}
            data={conceptos}
            rowKey={(c) => c.id}
            density="compact"
            emptyMessage={emptyConceptos}
          />
        </CardContent>
      </Card>

      {totales && <TotalesCard totales={totales} />}
      <NotasCard notas={proforma.notas} />
      {facturas.length > 0 && <FacturaAsociadaCard facturas={facturas} />}
    </PageContainer>
  );
}
