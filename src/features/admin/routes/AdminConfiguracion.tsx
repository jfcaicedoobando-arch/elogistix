import { Settings, CreditCard, Shield, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import TabPlanes from "@/features/admin/components/TabPlanes";
import TabSeguridadGlobal from "@/features/admin/components/TabSeguridadGlobal";
import TabCatalogosGlobales from "@/features/admin/components/TabCatalogosGlobales";
import ConfigOrganizacion from "@/features/admin/components/ConfigOrganizacion";

import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { useDocumentTitle } from "@/hooks/shared";

export default function AdminConfiguracion() {
  useDocumentTitle('Configuración Global');
  return (
    <PageContainer>
      <PageHeader
        icon={<Settings className="h-6 w-6 text-primary" />}
        title="Configuración Global"
        description="Parámetros globales de la plataforma que aplican a todas las organizaciones."
      />

      <Tabs defaultValue="seguridad">
        <TabsList className="h-auto bg-transparent p-0 border-b border-border rounded-none w-max min-w-full justify-start gap-1 overflow-x-auto scrollbar-thin">

          <TabsTrigger
            value="seguridad"
            className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-2.5"
          >
            <Shield className="h-3.5 w-3.5" /> Seguridad
          </TabsTrigger>
          <TabsTrigger
            value="planes"
            className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-2.5"
          >
            <CreditCard className="h-3.5 w-3.5" /> Planes
          </TabsTrigger>
          <TabsTrigger
            value="catalogos"
            className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-2.5"
          >
            <BookOpen className="h-3.5 w-3.5" /> Catálogos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="seguridad" className="mt-6">
          <TabSeguridadGlobal />
        </TabsContent>

        <TabsContent value="planes" className="mt-6">
          <TabPlanes />
        </TabsContent>

        <TabsContent value="catalogos" className="mt-6">
          <TabCatalogosGlobales />
        </TabsContent>
      </Tabs>


      <Separator />

      <ConfigOrganizacion />
    </PageContainer>
  );
}
