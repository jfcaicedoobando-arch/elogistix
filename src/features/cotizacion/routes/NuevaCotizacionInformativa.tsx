import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import WizardInformativa from "@/features/cotizacion/components/informativa/WizardInformativa";

export default function NuevaCotizacionInformativa() {
  return (
    <PageContainer>
      <PageHeader
        title="Nuevo tarifario"
        description="Cotización informativa: lista de tarifas vigentes durante un período. No genera embarques."
      />
      <WizardInformativa />
    </PageContainer>
  );
}
