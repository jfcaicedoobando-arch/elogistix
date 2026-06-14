import { PageHeader } from "@/components/shared/PageHeader";
import { TabProyeccion } from "@/features/facturacion/components/TabProyeccion";

export default function ProfitProyeccion() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Proyección de Facturación"
        description="Cuánto vas a facturar este mes según los ETA de los embarques"
      />
      <TabProyeccion />
    </div>
  );
}
