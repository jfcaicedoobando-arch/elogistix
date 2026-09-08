/**
 * Catálogos globales vistos por una empresa: aquí sólo se prende/apaga la
 * visibilidad para la organización activa (alta/edición/baja son de plataforma).
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Anchor, Ship, Package } from "lucide-react";
import TabPuertos from "./TabPuertos";
import TabNavieras from "./TabNavieras";
import TabTiposContenedor from "./TabTiposContenedor";

export default function TabCatalogos() {
  return (
    <Tabs defaultValue="puertos" className="space-y-4">
      <TabsList>
        <TabsTrigger value="puertos" className="gap-1.5">
          <Anchor className="h-3.5 w-3.5" /> Puertos
        </TabsTrigger>
        <TabsTrigger value="navieras" className="gap-1.5">
          <Ship className="h-3.5 w-3.5" /> Navieras
        </TabsTrigger>
        <TabsTrigger value="contenedores" className="gap-1.5">
          <Package className="h-3.5 w-3.5" /> Tipos de Contenedor
        </TabsTrigger>
      </TabsList>
      <TabsContent value="puertos"><TabPuertos /></TabsContent>
      <TabsContent value="navieras"><TabNavieras /></TabsContent>
      <TabsContent value="contenedores"><TabTiposContenedor /></TabsContent>
    </Tabs>
  );
}
