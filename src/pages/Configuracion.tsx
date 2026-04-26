import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Building2, DollarSign, FileText, Ship, ClipboardList, Bell, Anchor } from "lucide-react";
import { useConfiguracionState } from "@/hooks/useConfiguracionState";
import TabEmpresa from "@/components/configuracion/TabEmpresa";
import TabTiposCambio from "@/components/configuracion/TabTiposCambio";
import TabCotizaciones from "@/components/configuracion/TabCotizaciones";
import TabFacturacion from "@/components/configuracion/TabFacturacion";
import TabEmbarques from "@/components/configuracion/TabEmbarques";
import TabAlertas from "@/components/configuracion/TabAlertas";
import TabPuertos from "@/components/configuracion/TabPuertos";

export default function Configuracion() {
  const { s, set, isLoading, isSaving, handleSave } = useConfiguracionState();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
          <p className="text-sm text-muted-foreground">Parámetros generales del sistema</p>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
          <p className="text-sm text-muted-foreground">Parámetros generales del sistema</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>

      <Tabs defaultValue="empresa" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="empresa" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Empresa</TabsTrigger>
          <TabsTrigger value="tipos_cambio" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Tipos de Cambio</TabsTrigger>
          <TabsTrigger value="cotizaciones" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Cotizaciones</TabsTrigger>
          <TabsTrigger value="facturacion" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Facturación</TabsTrigger>
          <TabsTrigger value="embarques" className="gap-1.5"><Ship className="h-3.5 w-3.5" /> Embarques</TabsTrigger>
          <TabsTrigger value="alertas" className="gap-1.5"><Bell className="h-3.5 w-3.5" /> Alertas</TabsTrigger>
          <TabsTrigger value="puertos" className="gap-1.5"><Anchor className="h-3.5 w-3.5" /> Puertos</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa">
          <TabEmpresa nombre={s.nombre} setNombre={set("nombre")} subtitulo={s.subtitulo} setSubtitulo={set("subtitulo")} rfc={s.rfc} setRfc={set("rfc")} direccion={s.direccion} setDireccion={set("direccion")} email={s.email} setEmail={set("email")} telefono={s.telefono} setTelefono={set("telefono")} />
        </TabsContent>
        <TabsContent value="tipos_cambio">
          <TabTiposCambio usdMxn={s.usdMxn} setUsdMxn={set("usdMxn")} eurMxn={s.eurMxn} setEurMxn={set("eurMxn")} fuente={s.fuente} setFuente={set("fuente")} />
        </TabsContent>
        <TabsContent value="cotizaciones">
          <TabCotizaciones vigenciaDias={s.vigenciaDias} setVigenciaDias={set("vigenciaDias")} diasLibres={s.diasLibres} setDiasLibres={set("diasLibres")} monedaCot={s.monedaCot} setMonedaCot={set("monedaCot")} terminos={s.terminos} setTerminos={set("terminos")} />
        </TabsContent>
        <TabsContent value="facturacion">
          <TabFacturacion tasaIva={s.tasaIva} setTasaIva={set("tasaIva")} diasVenc={s.diasVenc} setDiasVenc={set("diasVenc")} serieFact={s.serieFact} setSerieFact={set("serieFact")} folioInicial={s.folioInicial} setFolioInicial={set("folioInicial")} monedaFact={s.monedaFact} setMonedaFact={set("monedaFact")} />
        </TabsContent>
        <TabsContent value="embarques">
          <TabEmbarques prefijo={s.prefijo} setPrefijo={set("prefijo")} tipoCargaDefault={s.tipoCargaDefault} setTipoCargaDefault={set("tipoCargaDefault")} monedaEmb={s.monedaEmb} setMonedaEmb={set("monedaEmb")} />
        </TabsContent>
        <TabsContent value="alertas">
          <TabAlertas diasEta={s.diasEta} setDiasEta={set("diasEta")} diasEtaCritica={s.diasEtaCritica} setDiasEtaCritica={set("diasEtaCritica")} diasFactVencer={s.diasFactVencer} setDiasFactVencer={set("diasFactVencer")} />
        </TabsContent>
        <TabsContent value="puertos">
          <TabPuertos />
        </TabsContent>
      </Tabs>
    </div>
  );
}
