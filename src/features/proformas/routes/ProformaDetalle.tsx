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
import { AccionesProforma } from "@/features/proformas/components/ProformaDetalleCards";
import { DocumentoDetalleShell } from "@/components/shared/documento/DocumentoDetalleShell";
import { buildKpisProforma } from "@/features/proformas/domain/proformaKpis";
import { ProformaTabs } from "@/features/proformas/components/detalle/ProformaTabs";
import { ProformaRail } from "@/features/proformas/components/detalle/ProformaRail";
import { ProformaDetalleHeader } from "@/features/proformas/components/detalle/ProformaDetalleHeader";
import { ErrorState } from "@/components/shared/states/ErrorState";


export default function ProformaDetalle() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useProformaDetalle(id);
  useRegisterBreadcrumbLabel(id, data?.proforma.numero);

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState label="Cargando proforma…" />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <ErrorState onRetry={() => void refetch()} />
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
    () =>
      // B-08: pasamos los totales persistidos para que el dominio advierta
      // (console.warn) si el cálculo difiere del total guardado.
      calcularTotalesProforma(data.conceptos, tasaIva, {}, {
        total_usd: data.proforma?.total_usd ?? null,
        total_mxn: data.proforma?.total_mxn ?? null,
      }),
    [data, tasaIva],
  );

  const { proforma, conceptos } = data;
  const timeline = resolveProformaTimelineFields(proforma);
  const emptyConceptos = proforma.es_consolidada
    ? "Proforma consolidada (ver detalle agregado en el PDF)."
    : "Sin conceptos.";

  return (
    <PageContainer>
      <DocumentoDetalleShell
        kpis={buildKpisProforma({
          totales,
          diasCredito: proforma.dias_credito,
          fechaEmision: proforma.fecha_emision,
          facturada: proforma.estado_proforma === "facturada",
        })}
        header={
          <ProformaDetalleHeader
            numero={proforma.numero}
            estadoProforma={proforma.estado_proforma}
            estadoCliente={timeline.estadoCliente}
            aceptadaPor={timeline.aceptadaPor}
            facturas={proforma.facturas_asociadas}
            clienteNombre={proforma.cliente_nombre}
            expediente={proforma.expediente}
            embarqueId={proforma.embarque_id}
            enviadaAt={timeline.enviadaAt}
            facturada={proforma.estado_proforma === "facturada"}
            actions={
              <AccionesProforma
                proforma={proforma}
                downloadingId={downloadingId}
                onDescargar={() => descargar(proforma)}
              />
            }
          />
        }
        rail={
          <ProformaRail
            proformaId={proforma.id}
            fechaEmision={proforma.fecha_emision}
            operador={proforma.operador}
            timeline={timeline}
            envios={proforma.envios}
            facturas={proforma.facturas_asociadas}
          />
        }
      >
        <ProformaTabs
          proforma={proforma}
          conceptos={conceptos}
          totales={totales}
          emptyConceptos={emptyConceptos}
        />
      </DocumentoDetalleShell>
    </PageContainer>
  );
}

