import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Anchor, Ship, Package } from "lucide-react";
import TabPuertos from "@/components/configuracion/TabPuertos";

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
          <Card>
            <CardHeader>
              <CardTitle>Catálogo de Navieras</CardTitle>
              <CardDescription>Gestión de líneas navieras disponibles en el sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Próximamente — actualmente definidas en código estático</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contenedores">
          <Card>
            <CardHeader>
              <CardTitle>Tipos de Contenedor</CardTitle>
              <CardDescription>Gestión de tipos de contenedor disponibles</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Próximamente — actualmente definidos en código estático</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
