/** /crm/contactos/:id — Ficha de contacto con empresas y oportunidades ligadas. */
import { useParams } from "react-router-dom";
import { UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { LoadingState } from "@/components/shared/states/LoadingState";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { useDocumentTitle, usePermissions } from "@/hooks/shared";
import { useContactoCrm } from "@/features/crm/hooks/useObjetosCrm";
import { PropiedadesCard } from "@/features/crm/components/objetos/PropiedadesCard";
import { VinculosCard } from "@/features/crm/components/objetos/VinculosCard";

export default function CrmContactoDetalle() {
  const { id = "" } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useContactoCrm(id);
  const { canEditCrm } = usePermissions();
  useDocumentTitle(data ? `Contacto · ${data.nombre}` : "Contacto");

  if (isLoading) return <LoadingState label="Cargando contacto…" />;
  if (isError || !data) {
    return (
      <PageContainer>
        <ErrorState
          title={isError ? "No se pudo cargar el contacto" : "Contacto no encontrado"}
          description="Revisa el enlace o vuelve a la lista."
          onRetry={isError ? () => void refetch() : undefined}
        />
      </PageContainer>
    );
  }

  const datos = [data.email, data.telefono].filter(Boolean).join(" · ") || "Sin correo ni teléfono";
  return (
    <PageContainer>
      <PageHeader icon={<UserRound className="h-6 w-6 text-primary" />} title={data.nombre} description={datos} />
      <PropiedadesCard objeto="contacto" registroId={id} canEdit={canEditCrm} />
      <div className="grid gap-4 md:grid-cols-2 mt-4">
        <VinculosCard
          titulo="Empresas" relacion="empresas-de-contacto" duenoId={id} rutaBase="/crm/empresas"
          canEdit={canEditCrm}
          edicion={{ tipo: "empresa-contacto", objeto: "empresa", par: (otro) => ({ aId: otro, bId: id }) }}
        />
        <VinculosCard
          titulo="Oportunidades" relacion="oportunidades-de-contacto" duenoId={id}
          rutaBase="/crm/oportunidades" canEdit={false}
        />
      </div>
    </PageContainer>
  );
}
