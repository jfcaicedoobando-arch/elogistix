import { Settings, CreditCard, Shield, BookOpen, Scale } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import TabPlanes from "@/features/admin/components/TabPlanes";
import TabSeguridadGlobal from "@/features/admin/components/TabSeguridadGlobal";
import TabCatalogosGlobales from "@/features/admin/components/TabCatalogosGlobales";
import TabOperacionesGlobal from "@/features/admin/components/TabOperacionesGlobal";
import ConfigOrganizacion from "@/features/admin/components/ConfigOrganizacion";

import { PageHeader } from "@/components/shared/PageHeader";

export default function AdminConfiguracion() {
  return (
    <div className="space-y-4 sm:space-y-6">
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
          <TabsTrigger
            value="operaciones"
            className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-2.5"
          >
            <Scale className="h-3.5 w-3.5" /> Operaciones
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

        <TabsContent value="operaciones" className="mt-6">
          <TabOperacionesGlobal />
        </TabsContent>
      </Tabs>


      <Separator />

      <ConfigOrganizacion />
    </div>
  );
}
