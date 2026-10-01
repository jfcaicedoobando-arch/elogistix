/** /crm/propiedades — Módulo de propiedades configurables (solo súper administrador). */
import { SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDocumentTitle, usePermissions } from "@/hooks/shared";
import { ListaPropiedadesAdmin } from "@/features/crm/components/propiedades/ListaPropiedadesAdmin";
import type { ObjetoCrm } from "@/features/crm/services/propiedadesCrm";

const OBJETOS: { valor: ObjetoCrm; etiqueta: string }[] = [
  { valor: "empresa", etiqueta: "Empresas" },
  { valor: "contacto", etiqueta: "Contactos" },
  { valor: "oportunidad", etiqueta: "Oportunidades" },
  { valor: "actividad", etiqueta: "Actividades" },
];

export default function CrmPropiedades() {
  useDocumentTitle("Propiedades del CRM");
  const { isSuperAdmin } = usePermissions();
  if (!isSuperAdmin) {
    return <div className="p-8 text-center text-body text-muted-foreground">Solo el súper administrador puede configurar propiedades.</div>;
  }
  return (
    <PageContainer>
      <PageHeader
        icon={<SlidersHorizontal className="h-6 w-6 text-primary" />}
        title="Propiedades del CRM"
        description="Campos que se capturan en cada objeto. Renombrar o archivar no borra datos guardados."
      />
      <Tabs defaultValue="empresa">
        <TabsList>
          {OBJETOS.map((o) => <TabsTrigger key={o.valor} value={o.valor}>{o.etiqueta}</TabsTrigger>)}
        </TabsList>
        {OBJETOS.map((o) => (
          <TabsContent key={o.valor} value={o.valor} className="pt-3">
            <ListaPropiedadesAdmin objeto={o.valor} />
          </TabsContent>
        ))}
      </Tabs>
    </PageContainer>
  );
}
