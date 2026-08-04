import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Save, Building2, Receipt, Anchor, Wrench, Scale } from "lucide-react";
import { useConfiguracionState } from "@/features/configuracion/hooks";
import { useAuth } from "@/lib/contexts/AuthContext";
import TabEmpresa from "@/features/configuracion/components/TabEmpresa";
import { OrgInfoCard } from "@/features/configuracion/components/OrgInfoCard";
import TabFacturacion from "@/features/configuracion/components/TabFacturacion";
import TabPuertos from "@/features/configuracion/components/TabPuertos";
import TabOperaciones from "@/features/configuracion/components/TabOperaciones";
import TabExportar from "@/features/admin/components/TabExportar";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { AsyncBoundary } from "@/components/shared/states/AsyncBoundary";


function getSaveButtonLabel(isSaving: boolean): string {
  return isSaving ? "Guardando..." : "Guardar Cambios";
}

const TABS_CON_GUARDAR = new Set(["empresa", "facturacion"]);

export default function Configuracion() {
  const { s, set, isLoading, isError, refetch, isSaving, isDirty, handleSave } = useConfiguracionState();
  const { effectiveRole } = useAuth();
  const esContador = effectiveRole === "contador";
  const [tab, setTab] = useState<string>(esContador ? "facturacion" : "empresa");

  // P1-1: antes un fallo dejaba el esqueleto para siempre. Ahora hay error + retry.
  if (isLoading || isError) {
    return (
      <PageContainer>
        <PageHeader title="Configuración" description="Parámetros generales del sistema" />
        <AsyncBoundary
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
          skeleton={<ListSkeleton rows={4} />}
          errorTitle="No se pudo cargar la configuración"
        >
          {null}
        </AsyncBoundary>
      </PageContainer>
    );
  }


  // Contadores sólo tienen visibilidad al catálogo de productos (pestaña Facturación).
  // No necesitan botón "Guardar" porque el catálogo tiene su propio flujo por producto.
  const mostrarGuardar = !esContador && TABS_CON_GUARDAR.has(tab);

  return (
    <PageContainer>
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
          {!esContador && (
            <TabsTrigger value="empresa" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Empresa</TabsTrigger>
          )}
          <TabsTrigger value="facturacion" className="gap-1.5"><Receipt className="h-3.5 w-3.5" /> Facturación</TabsTrigger>
          {!esContador && (
            <>
              <TabsTrigger value="catalogos" className="gap-1.5"><Anchor className="h-3.5 w-3.5" /> Catálogos</TabsTrigger>
              <TabsTrigger value="operaciones" className="gap-1.5"><Scale className="h-3.5 w-3.5" /> Operaciones</TabsTrigger>
              <TabsTrigger value="herramientas" className="gap-1.5"><Wrench className="h-3.5 w-3.5" /> Herramientas</TabsTrigger>
            </>
          )}
        </TabsList>

        {!esContador && (
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
        )}
        <TabsContent value="facturacion">
          <TabFacturacion />
        </TabsContent>
        {!esContador && (
          <>
            <TabsContent value="catalogos"><TabPuertos /></TabsContent>
            <TabsContent value="operaciones"><TabOperaciones /></TabsContent>
            <TabsContent value="herramientas"><TabExportar /></TabsContent>
          </>
        )}
      </Tabs>
    </PageContainer>
  );
}
