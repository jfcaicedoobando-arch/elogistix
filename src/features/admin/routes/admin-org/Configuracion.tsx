import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Save, Building2, FileText, Anchor, Wrench, Scale } from "lucide-react";
import { useConfiguracionState } from "@/features/configuracion/hooks";
import TabEmpresa from "@/features/configuracion/components/TabEmpresa";
import { OrgInfoCard } from "@/features/configuracion/components/OrgInfoCard";
import TabFacturacion from "@/features/configuracion/components/TabFacturacion";
import TabPuertos from "@/features/configuracion/components/TabPuertos";
import TabOperaciones from "@/features/configuracion/components/TabOperaciones";
import TabExportar from "@/features/admin/components/TabExportar";
import { PageHeader } from "@/components/shared/PageHeader";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";

function getSaveButtonLabel(isSaving: boolean): string {
  return isSaving ? "Guardando..." : "Guardar Cambios";
}

const TABS_CON_GUARDAR = new Set(["empresa", "facturacion"]);

export default function Configuracion() {
  const { s, set, isLoading, isSaving, isDirty, handleSave } = useConfiguracionState();
  const [tab, setTab] = useState<string>("empresa");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Configuración" description="Parámetros generales del sistema" />
        <ListSkeleton rows={4} />
      </div>
    );
  }

  const mostrarGuardar = TABS_CON_GUARDAR.has(tab);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Parámetros generales del sistema"
        actions={mostrarGuardar ? (
          <Button onClick={handleSave} disabled={isSaving || !isDirty} title={!isDirty ? "No hay cambios pendientes" : undefined}>
            <Save className="h-4 w-4 mr-2" />
            {getSaveButtonLabel(isSaving)}
          </Button>
        ) : null}
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="empresa" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Empresa</TabsTrigger>
          <TabsTrigger value="facturacion" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Facturación</TabsTrigger>
          <TabsTrigger value="catalogos" className="gap-1.5"><Anchor className="h-3.5 w-3.5" /> Catálogos</TabsTrigger>
          <TabsTrigger value="operaciones" className="gap-1.5"><Scale className="h-3.5 w-3.5" /> Operaciones</TabsTrigger>
          <TabsTrigger value="herramientas" className="gap-1.5"><Wrench className="h-3.5 w-3.5" /> Herramientas</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa" className="space-y-4">
          <OrgInfoCard />
          <TabEmpresa
            nombre={s.nombre} setNombre={set("nombre")}
            subtitulo={s.subtitulo} setSubtitulo={set("subtitulo")}
            rfc={s.rfc} setRfc={set("rfc")}
            direccion={s.direccion} setDireccion={set("direccion")}
            email={s.email} setEmail={set("email")}
            telefono={s.telefono} setTelefono={set("telefono")}
          />
        </TabsContent>
        <TabsContent value="facturacion">
          <TabFacturacion tasaIva={s.tasaIva} setTasaIva={set("tasaIva")} />
        </TabsContent>
        <TabsContent value="catalogos"><TabPuertos /></TabsContent>
        <TabsContent value="operaciones"><TabOperaciones /></TabsContent>
        <TabsContent value="herramientas"><TabExportar /></TabsContent>
      </Tabs>
    </div>
  );
}
