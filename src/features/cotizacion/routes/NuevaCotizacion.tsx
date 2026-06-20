import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/shared";
import { useClientesForSelect } from "@/features/cliente/hooks";
import { useCreateCotizacion, useUpdateCotizacion } from "@/features/cotizacion/hooks";
import { useUpsertCotizacionCostos } from "@/features/cotizacion/hooks";
import { useRegistrarActividad } from "@/hooks/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useCotizacionWizardForm } from "@/features/cotizacion/hooks";
import CotizacionWizardLayout from "@/features/cotizacion/components/CotizacionWizardLayout";

export default function NuevaCotizacion() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: clientes = [] } = useClientesForSelect();

  const w = useCotizacionWizardForm({
    navigate,
    toast,
    userEmail: user?.email ?? "",
    clientes,
    mutations: {
      crearCotizacion: useCreateCotizacion(),
      updateCotizacion: useUpdateCotizacion(),
      upsertCostos: useUpsertCotizacionCostos(),
      registrarActividad: useRegistrarActividad(),
    },
  });

  return (
    <CotizacionWizardLayout
      w={w}
      clientes={clientes}
      title="Nueva Cotización"
      subtitle="Completa los datos para crear una cotización"
      onBack={() => navigate("/cotizaciones")}
      saveLabel="Guardar Cotización"
    />
  );
}
