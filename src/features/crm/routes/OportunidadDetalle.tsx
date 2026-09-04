/**
 * /crm/oportunidades/:id — Detalle de oportunidad con tabs internas.
 * Resumen / Comunicación / Trazabilidad para reducir scroll.
 */
import { useParams } from "react-router-dom";
import { useOportunidad, useEtapasPipeline } from "@/features/crm/hooks";
import { OportunidadDetalleContent } from "@/features/crm/components/oportunidadDetalle/OportunidadDetalleContent";
import { LoadingState } from "@/components/shared/states/LoadingState";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { useDocumentTitle } from "@/hooks/shared";
import { PageContainer } from "@/components/shared/PageContainer";

export default function OportunidadDetalle() {
  const { id } = useParams<{ id: string }>();
  const { data: op, isLoading, isError, refetch } = useOportunidad(id);
  useDocumentTitle(op ? `Oportunidad · ${op.nombre}` : "Oportunidad");
  const { data: etapas = [] } = useEtapasPipeline();

  if (isLoading) {
    return <LoadingState label="Cargando oportunidad…" />;
  }
  if (isError) {
    return (
      <PageContainer>
        <ErrorState
          title="No se pudo cargar la oportunidad"
          description="Revisa tu conexión e intenta de nuevo."
          onRetry={() => void refetch()}
        />
      </PageContainer>
    );
  }
  if (!op) {
    return (
      <PageContainer>
        <ErrorState
          title="Oportunidad no encontrada"
          description="La oportunidad que buscas no existe o fue eliminada."
        />
      </PageContainer>
    );
  }
  return (
    <PageContainer>
      <OportunidadDetalleContent op={op} etapas={etapas} />
    </PageContainer>
  );
}
