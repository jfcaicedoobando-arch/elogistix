import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useClientesForSelect } from "@/hooks/cliente";
import { useCreateCotizacion, useUpdateCotizacion } from "@/hooks/cotizacion";
import { useUpsertCotizacionCostos } from "@/hooks/cotizacion";
import { useRegistrarActividad } from "@/hooks/shared";
import { useAuth } from "@/contexts/AuthContext";
import { useCotizacionWizardForm } from "@/hooks/cotizacion";
import CotizacionWizardLayout from "@/components/cotizacion/CotizacionWizardLayout";

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
