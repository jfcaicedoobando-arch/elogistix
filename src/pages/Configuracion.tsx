import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Building2, DollarSign, FileText, Ship, ClipboardList, Bell, Anchor } from "lucide-react";
import { useConfiguracion, useUpdateConfiguracion, type ConfigItem } from "@/hooks/useConfiguracion";
import TabEmpresa from "@/components/configuracion/TabEmpresa";
import TabTiposCambio from "@/components/configuracion/TabTiposCambio";
import TabCotizaciones from "@/components/configuracion/TabCotizaciones";
import TabFacturacion from "@/components/configuracion/TabFacturacion";
import TabEmbarques from "@/components/configuracion/TabEmbarques";
import TabAlertas from "@/components/configuracion/TabAlertas";
import TabPuertos from "@/components/configuracion/TabPuertos";

function getVal<T>(data: ConfigItem[] | undefined, categoria: string, clave: string, fallback: T): T {
  if (!data) return fallback;
  const item = data.find((c) => c.categoria === categoria && c.clave === clave);
  return item ? (item.valor as T) : fallback;
}

interface ConfigState {
  nombre: string;
  subtitulo: string;
  rfc: string;
  direccion: string;
  email: string;
  telefono: string;
  usdMxn: string;
  eurMxn: string;
  fuente: string;
  vigenciaDias: string;
  diasLibres: string;
  monedaCot: string;
  terminos: string;
  tasaIva: string;
  diasVenc: string;
  serieFact: string;
  folioInicial: string;
  monedaFact: string;
  prefijo: string;
  tipoCargaDefault: string;
  monedaEmb: string;
  diasEta: string;
  diasEtaCritica: string;
  diasFactVencer: string;
}

function buildStateFromConfig(config: ConfigItem[] | undefined): ConfigState {
  return {
    nombre: getVal(config, "empresa", "nombre", ""),
    subtitulo: getVal(config, "empresa", "subtitulo", ""),
    rfc: getVal(config, "empresa", "rfc", ""),
    direccion: getVal(config, "empresa", "direccion_fiscal", ""),
    email: getVal(config, "empresa", "email", ""),
    telefono: getVal(config, "empresa", "telefono", ""),
    usdMxn: String(getVal(config, "tipos_cambio", "usd_mxn_default", 17.25)),
    eurMxn: String(getVal(config, "tipos_cambio", "eur_mxn_default", 18.5)),
    fuente: getVal(config, "tipos_cambio", "fuente", "api"),
    vigenciaDias: String(getVal(config, "cotizaciones", "vigencia_dias", 15)),
    diasLibres: String(getVal(config, "cotizaciones", "dias_libres_destino", 0)),
    monedaCot: getVal(config, "cotizaciones", "moneda_default", "USD"),
    terminos: getVal(config, "cotizaciones", "terminos_condiciones", ""),
    tasaIva: String(getVal(config, "facturacion", "tasa_iva", 16)),
    diasVenc: String(getVal(config, "facturacion", "dias_vencimiento", 30)),
    serieFact: getVal(config, "facturacion", "serie_factura", "A"),
    folioInicial: String(getVal(config, "facturacion", "folio_inicial", 1)),
    monedaFact: getVal(config, "facturacion", "moneda_default", "MXN"),
    prefijo: getVal(config, "embarques", "prefijo_expediente", "EXP"),
    tipoCargaDefault: getVal(config, "embarques", "tipo_carga_default", "Carga General"),
    monedaEmb: getVal(config, "embarques", "moneda_default", "USD"),
    diasEta: String(getVal(config, "alertas", "dias_eta_alerta", 7)),
    diasEtaCritica: String(getVal(config, "alertas", "dias_eta_critica", 3)),
    diasFactVencer: String(getVal(config, "alertas", "dias_factura_vencer", 7)),
  };
}

const INITIAL_STATE: ConfigState = buildStateFromConfig(undefined);

export default function Configuracion() {
  const { data: config, isLoading } = useConfiguracion();
  const updateConfig = useUpdateConfiguracion();
  const [s, setS] = useState<ConfigState>(INITIAL_STATE);

  useEffect(() => {
    if (config) setS(buildStateFromConfig(config));
  }, [config]);

  const set = <K extends keyof ConfigState>(key: K) => (value: ConfigState[K]) =>
    setS(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    updateConfig.mutate([
      { categoria: "empresa", clave: "nombre", valor: s.nombre },
      { categoria: "empresa", clave: "subtitulo", valor: s.subtitulo },
      { categoria: "empresa", clave: "rfc", valor: s.rfc },
      { categoria: "empresa", clave: "direccion_fiscal", valor: s.direccion },
      { categoria: "empresa", clave: "email", valor: s.email },
      { categoria: "empresa", clave: "telefono", valor: s.telefono },
      { categoria: "tipos_cambio", clave: "usd_mxn_default", valor: parseFloat(s.usdMxn) || 17.25 },
      { categoria: "tipos_cambio", clave: "eur_mxn_default", valor: parseFloat(s.eurMxn) || 18.5 },
      { categoria: "tipos_cambio", clave: "fuente", valor: s.fuente },
      { categoria: "cotizaciones", clave: "vigencia_dias", valor: parseInt(s.vigenciaDias) || 15 },
      { categoria: "cotizaciones", clave: "dias_libres_destino", valor: parseInt(s.diasLibres) || 0 },
      { categoria: "cotizaciones", clave: "moneda_default", valor: s.monedaCot },
      { categoria: "cotizaciones", clave: "terminos_condiciones", valor: s.terminos },
      { categoria: "facturacion", clave: "tasa_iva", valor: parseInt(s.tasaIva) || 16 },
      { categoria: "facturacion", clave: "dias_vencimiento", valor: parseInt(s.diasVenc) || 30 },
      { categoria: "facturacion", clave: "serie_factura", valor: s.serieFact },
      { categoria: "facturacion", clave: "folio_inicial", valor: parseInt(s.folioInicial) || 1 },
      { categoria: "facturacion", clave: "moneda_default", valor: s.monedaFact },
      { categoria: "embarques", clave: "prefijo_expediente", valor: s.prefijo },
      { categoria: "embarques", clave: "tipo_carga_default", valor: s.tipoCargaDefault },
      { categoria: "embarques", clave: "moneda_default", valor: s.monedaEmb },
      { categoria: "alertas", clave: "dias_eta_alerta", valor: parseInt(s.diasEta) || 7 },
      { categoria: "alertas", clave: "dias_eta_critica", valor: parseInt(s.diasEtaCritica) || 3 },
      { categoria: "alertas", clave: "dias_factura_vencer", valor: parseInt(s.diasFactVencer) || 7 },
    ]);
  };

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
        <Button onClick={handleSave} disabled={updateConfig.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {updateConfig.isPending ? "Guardando..." : "Guardar Cambios"}
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
