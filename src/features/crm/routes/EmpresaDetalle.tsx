/** /crm/empresas/:id — Ficha de empresa con contactos y oportunidades ligadas. */
import { useParams } from "react-router-dom";
import { ArrowRight, Building2 } from "lucide-react";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { LoadingState } from "@/components/shared/states/LoadingState";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDocumentTitle, usePermissions } from "@/hooks/shared";
import { formatFechaDia } from "@/lib/formatters/dates";
import { useEmpresaCrm, usePasarAProspecto } from "@/features/crm/hooks/useObjetosCrm";
import { estadoEmpresa } from "@/features/crm/services/estadoEmpresaCrm";
import { varianteEstadoEmpresa } from "@/features/crm/components/objetos/FiltroEstadoEmpresaSelect";
import { PropiedadesCard } from "@/features/crm/components/objetos/PropiedadesCard";
import { VinculosCard } from "@/features/crm/components/objetos/VinculosCard";
import { DesglosePuntajeCard } from "@/features/crm/components/scoring/DesglosePuntajeCard";

export default function CrmEmpresaDetalle() {
  const { id = "" } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useEmpresaCrm(id);
  const { canEditCrm } = usePermissions();
  const pasar = usePasarAProspecto();
  useDocumentTitle(data ? `Empresa · ${data.nombre}` : "Empresa");
  const estado = data ? estadoEmpresa(data) : null;

  return (
    <PageContainer>
      <DetailHeader
        backTo="/crm/empresas"
        icon={<Building2 className="size-6 text-accent" />}
        title={data?.nombre ?? "Empresa"}
        subtitle={data ? `Alta: ${formatFechaDia(data.created_at)}` : undefined}
        badge={estado ? <Badge variant={varianteEstadoEmpresa(estado)}>{estado}</Badge> : undefined}
        actions={canEditCrm && estado === "Lead" ? (
          <Button onClick={() => pasar.mutate(id)} disabled={pasar.isPending}>
            <ArrowRight className="size-4" /> Pasar a prospecto
          </Button>
        ) : undefined}
      />
      {isLoading ? <LoadingState label="Cargando empresa…" /> : isError || !data ? (
        <ErrorState title={isError ? "No se pudo cargar la empresa" : "Empresa no encontrada"}
          description="Revisa el enlace o vuelve a la lista." onRetry={isError ? () => void refetch() : undefined} />
      ) : <>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <PropiedadesCard objeto="empresa" registroId={id} canEdit={canEditCrm} />
        <DesglosePuntajeCard objeto="empresa" registroId={id} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 mt-4">
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
      </>}
    </PageContainer>
  );
}
