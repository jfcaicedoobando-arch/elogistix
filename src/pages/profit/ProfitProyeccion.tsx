import { PageHeader } from "@/components/shared/PageHeader";
import { TabProyeccion } from "@/components/facturacion/TabProyeccion";

export default function ProfitProyeccion() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Proyección de Facturación"
        description="Cuánto vas a facturar este mes según los ETA de los embarques"
      />
      <TabProyeccion />
    </div>
  );
}
