/**
 * Página dedicada `/proformas`: listado completo de proformas con búsqueda,
 * filtros (Todas / Pendientes / Facturadas), paginación, export CSV y acción
 * "Marcar facturada". Reutiliza el componente <TabProformas/> que ya vive
 * dentro del módulo de Facturación para no duplicar lógica.
 */
import { FileSpreadsheet } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabProformas } from "@/features/facturacion/components/TabProformas";

export default function ProformasListado() {
  return (
    <PageContainer>
      <PageHeader
        icon={<FileSpreadsheet className="h-6 w-6 text-primary" />}
        title="Proformas"
        description="Listado completo de proformas generadas. Filtra por estado, busca por número/expediente/cliente y marca como facturadas."
      />
      <TabProformas />
    </PageContainer>
  );
}
