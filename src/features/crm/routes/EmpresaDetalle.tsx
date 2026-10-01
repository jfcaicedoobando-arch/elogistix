/** /crm/empresas/:id — Ficha de empresa con contactos y oportunidades ligadas. */
import { useParams } from "react-router-dom";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { LoadingState } from "@/components/shared/states/LoadingState";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { Badge } from "@/components/ui/badge";
import { useDocumentTitle, usePermissions } from "@/hooks/shared";
import { formatFechaDia } from "@/lib/formatters/dates";
import { useEmpresaCrm } from "@/features/crm/hooks/useObjetosCrm";
import { VinculosCard } from "@/features/crm/components/objetos/VinculosCard";

export default function CrmEmpresaDetalle() {
  const { id = "" } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useEmpresaCrm(id);
  const { canEditCrm } = usePermissions();
  useDocumentTitle(data ? `Empresa · ${data.nombre}` : "Empresa");

  if (isLoading) return <LoadingState label="Cargando empresa…" />;
  if (isError || !data) {
    return (
      <PageContainer>
        <ErrorState
          title={isError ? "No se pudo cargar la empresa" : "Empresa no encontrada"}
          description="Revisa el enlace o vuelve a la lista."
          onRetry={isError ? () => void refetch() : undefined}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<Building2 className="h-6 w-6 text-primary" />}
        title={data.nombre}
        description={`Alta: ${formatFechaDia(data.created_at)}`}
        subHeader={data.cliente_id ? <Badge variant="secondary">Cliente</Badge> : <Badge variant="outline">Prospecto</Badge>}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <VinculosCard
          titulo="Contactos" relacion="contactos-de-empresa" duenoId={id} rutaBase="/crm/contactos"
          canEdit={canEditCrm}
          edicion={{ tipo: "empresa-contacto", objeto: "contacto", par: (otro) => ({ aId: id, bId: otro }) }}
        />
        <VinculosCard
          titulo="Oportunidades" relacion="oportunidades-de-empresa" duenoId={id}
          rutaBase="/crm/oportunidades" canEdit={false}
        />
      </div>
    </PageContainer>
  );
}
