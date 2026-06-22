/**
 * Página Presupuesto: 3 tabs (Captura, Vs Real, Configuración).
 */
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabCaptura } from "@/features/presupuesto/components/TabCaptura";
import { TabVsReal } from "@/features/presupuesto/components/TabVsReal";
import { TabCategorias } from "@/features/presupuesto/components/TabCategorias";

export default function ProfitPresupuesto() {
  const [anio, setAnio] = useState(new Date().getFullYear());

  return (
    <div className="space-y-4">
      <PageHeader
        title="Presupuesto vs Real"
        description="Control mensual de gasto de administración por categoría."
      />
      <Tabs defaultValue="captura" className="space-y-3">
        <TabsList>
          <TabsTrigger value="captura">Captura</TabsTrigger>
          <TabsTrigger value="vs-real">Vs Real</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
        </TabsList>
        <TabsContent value="captura"><TabCaptura anio={anio} onAnioChange={setAnio} /></TabsContent>
        <TabsContent value="vs-real"><TabVsReal /></TabsContent>
        <TabsContent value="config"><TabCategorias /></TabsContent>
      </Tabs>
    </div>
  );
}
