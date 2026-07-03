import { PageHeader } from "@/components/shared/PageHeader";
import { TabProyeccion } from "@/features/facturacion/components/TabProyeccion";
import { PageContainer } from "@/components/shared/PageContainer";

export default function ProfitProyeccion() {
  return (
    <PageContainer>
      <PageHeader
        title="Proyección de Facturación"
        description="Cuánto vas a facturar este mes según los ETA de los embarques"
      />
      <TabProyeccion />
    </PageContainer>
  );
}
