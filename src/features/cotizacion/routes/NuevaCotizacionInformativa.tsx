import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import WizardInformativa from "@/features/cotizacion/components/informativa/WizardInformativa";
import { useDocumentTitle } from "@/hooks/shared";

export default function NuevaCotizacionInformativa() {
  useDocumentTitle("Nueva cotización informativa");
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
