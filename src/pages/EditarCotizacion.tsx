import { useParams, useNavigate, Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useClientesForSelect } from "@/hooks/useClientes";
import { useCotizacion, useUpdateCotizacion, useCreateCotizacion } from "@/hooks/useCotizaciones";
import { useCotizacionCostos, useUpsertCotizacionCostos } from "@/hooks/useCotizacionCostos";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useCotizacionWizardForm } from "@/hooks/useCotizacionWizardForm";
import CotizacionWizardLayout from "@/components/cotizacion/CotizacionWizardLayout";
import type { NavigateFunction } from "react-router-dom";
import type { CotizacionRow } from "@/hooks/useCotizaciones";
import type { CostoCotizacion } from "@/hooks/useCotizacionCostos";

export default function EditarCotizacion() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { canEdit } = usePermissions();
  const { data: clientes = [] } = useClientesForSelect();
  const { data: cotizacion, isLoading } = useCotizacion(id);
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
      title="Editar Cotización"
      subtitle={cotizacion.folio}
      onBack={() => navigate(`/cotizaciones/${cotizacion.id}`)}
      saveLabel="Guardar Cambios"
    />
  );
}
