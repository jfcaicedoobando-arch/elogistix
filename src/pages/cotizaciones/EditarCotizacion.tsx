import { useParams, useNavigate, Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useClientesForSelect } from "@/hooks/cliente";
import { useCotizacion, useUpdateCotizacion, useCreateCotizacion } from "@/hooks/cotizacion";
import { useCotizacionCostos, useUpsertCotizacionCostos } from "@/hooks/cotizacion";
import { useRegistrarActividad } from "@/hooks/shared";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/shared";
import { useCotizacionWizardForm } from "@/hooks/cotizacion";
import CotizacionWizardLayout from "@/components/cotizacion/CotizacionWizardLayout";
import type { NavigateFunction } from "react-router-dom";
import type { CotizacionRow } from "@/hooks/cotizacion";
import type { CostoCotizacion } from "@/hooks/cotizacion";
import { useRegisterBreadcrumbLabel } from "@/contexts/BreadcrumbContext";

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
    return <div className="space-y-4 p-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!cotizacion || !canEdit || cotizacion.estado !== "Borrador") {
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
  toast: ReturnType<typeof import("@/hooks/use-toast").useToast>["toast"];
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
