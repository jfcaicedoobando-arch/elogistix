import { PageHeader } from "@/components/shared/PageHeader";
import WizardInformativa from "@/features/cotizacion/components/informativa/WizardInformativa";

export default function NuevaCotizacionInformativa() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nuevo tarifario"
        description="Cotización informativa: lista de tarifas vigentes durante un período. No genera embarques."
      />
      <WizardInformativa />
    </div>
  );
}
