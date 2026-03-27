import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Anchor, Ship, Package } from "lucide-react";
import TabPuertos from "@/components/configuracion/TabPuertos";
import TabNavieras from "@/components/configuracion/TabNavieras";
import TabTiposContenedor from "@/components/configuracion/TabTiposContenedor";

export default function TabCatalogosGlobales() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="puertos">
        <TabsList>
          <TabsTrigger value="puertos" className="gap-1">
            <Anchor className="h-3.5 w-3.5" /> Puertos
          </TabsTrigger>
          <TabsTrigger value="navieras" className="gap-1">
            <Ship className="h-3.5 w-3.5" /> Navieras
          </TabsTrigger>
          <TabsTrigger value="contenedores" className="gap-1">
            <Package className="h-3.5 w-3.5" /> Tipos de Contenedor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="puertos">
          <TabPuertos />
        </TabsContent>

        <TabsContent value="navieras">
          <TabNavieras />
        </TabsContent>

        <TabsContent value="contenedores">
          <TabTiposContenedor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
