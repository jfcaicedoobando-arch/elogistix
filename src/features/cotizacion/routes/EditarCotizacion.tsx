import { useParams, useNavigate, Navigate } from "react-router-dom";
import { DetailSkeleton } from "@/components/shared/skeletons";
import { PageContainer } from "@/components/shared/PageContainer";
import { useToast } from "@/hooks/shared";
import { useClientesForSelect } from "@/features/cliente/hooks";
import { useCotizacion, useUpdateCotizacion, useCreateCotizacion } from "@/features/cotizacion/hooks";
import { useCotizacionCostos, useUpsertCotizacionCostos } from "@/features/cotizacion/hooks";
import { useRegistrarActividad } from "@/hooks/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { usePermissions } from "@/hooks/shared";
import { useCotizacionWizardForm } from "@/features/cotizacion/hooks";
import CotizacionWizardLayout from "@/features/cotizacion/components/CotizacionWizardLayout";
import type { NavigateFunction } from "react-router-dom";
import type { CotizacionRow } from "@/features/cotizacion/hooks";
import type { CostoCotizacion } from "@/features/cotizacion/hooks";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import { esEstadoEditableEnWizard } from "@/features/cotizacion/domain/estadosEditables";


export default function EditarCotizacion() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { canEdit } = usePermissions();
  const { data: clientes = [] } = useClientesForSelect();
  const { data: cotizacion, isLoading } = useCotizacion(id);
  useRegisterBreadcrumbLabel(id, cotizacion?.folio);
  const { data: costos, isLoading: costosLoading } = useCotizacionCostos(id);

  if (isLoading || costosLoading) {
    return <PageContainer><DetailSkeleton sections={1} /></PageContainer>;
  }

  if (!cotizacion || !canEdit || !esEstadoEditableEnWizard(cotizacion.estado)) {
    return <Navigate to={`/cotizaciones/${id}`} replace />;
  }


  return (
    <EditarCotizacionForm
      cotizacion={cotizacion}
      costos={costos ?? []}
      clientes={clientes}
      navigate={navigate}
      toast={toast}
      userEmail={user?.email ?? ""}
    />
  );
}

function EditarCotizacionForm({
  cotizacion,
  costos,
  clientes,
  navigate,
  toast,
  userEmail,
}: {
  cotizacion: CotizacionRow;
  costos: CostoCotizacion[];
  clientes: { id: string; nombre: string }[];
  navigate: NavigateFunction;
  toast: ReturnType<typeof import("@/hooks/shared").useToast>["toast"];
  userEmail: string;
}) {
  const w = useCotizacionWizardForm({
    navigate,
    toast,
    userEmail,
    clientes,
    mutations: {
      crearCotizacion: useCreateCotizacion(),
      updateCotizacion: useUpdateCotizacion(),
      upsertCostos: useUpsertCotizacionCostos(),
      registrarActividad: useRegistrarActividad(),
    },
    initialData: cotizacion,
    initialCostos: costos,
  });

  return (
    <CotizacionWizardLayout
      w={w}
      clientes={clientes}
      title={`Editar cotización ${cotizacion.folio}`}
      subtitle="Modifica los datos generales, ruta y conceptos de la cotización"
      onBack={() => navigate(`/cotizaciones/${cotizacion.id}`)}
      saveLabel="Guardar Cambios"
    />
  );
}
