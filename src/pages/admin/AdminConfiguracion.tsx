import { Settings, CreditCard, Shield, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import TabPlanes from "@/components/admin/TabPlanes";
import TabSeguridadGlobal from "@/components/admin/TabSeguridadGlobal";
import TabCatalogosGlobales from "@/components/admin/TabCatalogosGlobales";
import ConfigOrganizacion from "@/components/admin/ConfigOrganizacion";

export default function AdminConfiguracion() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Configuración Global
        </h1>
        <p className="text-muted-foreground mt-1">
          Parámetros globales de la plataforma que aplican a todas las organizaciones.
        </p>
      </div>

      <Tabs defaultValue="seguridad">
        <TabsList>
          <TabsTrigger value="seguridad" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Seguridad
          </TabsTrigger>
          <TabsTrigger value="planes" className="gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Planes
          </TabsTrigger>
          <TabsTrigger value="catalogos" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Catálogos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="seguridad">
          <TabSeguridadGlobal />
        </TabsContent>

        <TabsContent value="planes">
          <TabPlanes />
        </TabsContent>

        <TabsContent value="catalogos">
          <TabCatalogosGlobales />
        </TabsContent>
      </Tabs>

      <Separator />

      <ConfigOrganizacion />
    </div>
  );
}
