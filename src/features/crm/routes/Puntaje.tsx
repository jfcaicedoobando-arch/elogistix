/** /crm/puntaje — Criterios y cortes del puntaje A/B/C (solo súper administrador). */
import { Gauge } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDocumentTitle, usePermissions } from "@/hooks/shared";
import { ReglasScoringAdmin } from "@/features/crm/components/scoring/ReglasScoringAdmin";

export default function CrmPuntaje() {
  useDocumentTitle("Puntaje del CRM");
  const { isSuperAdmin } = usePermissions();
  if (!isSuperAdmin) {
    return <div className="p-8 text-center text-body text-muted-foreground">Solo el súper administrador puede configurar el puntaje.</div>;
  }
  return (
    <PageContainer>
      <PageHeader
        icon={<Gauge className="h-6 w-6 text-primary" />}
        title="Puntaje A/B/C"
        description="Qué datos suman puntos y desde cuántos puntos una empresa u oportunidad es A, B o C."
      />
      <Tabs defaultValue="empresa">
        <TabsList>
          <TabsTrigger value="empresa">Empresas</TabsTrigger>
          <TabsTrigger value="oportunidad">Oportunidades</TabsTrigger>
        </TabsList>
        <TabsContent value="empresa" className="pt-3"><ReglasScoringAdmin objeto="empresa" /></TabsContent>
        <TabsContent value="oportunidad" className="pt-3"><ReglasScoringAdmin objeto="oportunidad" /></TabsContent>
      </Tabs>
    </PageContainer>
  );
}
