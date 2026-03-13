import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Building2, DollarSign, FileText, Ship, ClipboardList, Bell, Anchor } from "lucide-react";
import { useConfiguracion, useUpdateConfiguracion } from "@/hooks/useConfiguracion";
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

export default function Configuracion() {
  const { data: config, isLoading } = useConfiguracion();
  const updateConfig = useUpdateConfiguracion();

  // Empresa
  const [nombre, setNombre] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [rfc, setRfc] = useState("");
  const [direccion, setDireccion] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");

  // Tipos de cambio
  const [usdMxn, setUsdMxn] = useState("17.25");
  const [eurMxn, setEurMxn] = useState("18.50");
  const [fuente, setFuente] = useState("api");

  // Cotizaciones
  const [vigenciaDias, setVigenciaDias] = useState("15");
  const [diasLibres, setDiasLibres] = useState("0");
  const [monedaCot, setMonedaCot] = useState("USD");
  const [terminos, setTerminos] = useState("");

  // Facturación
  const [tasaIva, setTasaIva] = useState("16");
  const [diasVenc, setDiasVenc] = useState("30");
  const [serieFact, setSerieFact] = useState("A");
  const [folioInicial, setFolioInicial] = useState("1");
  const [monedaFact, setMonedaFact] = useState("MXN");

  // Embarques
  const [prefijo, setPrefijo] = useState("EXP");
  const [tipoCargaDefault, setTipoCargaDefault] = useState("Carga General");
  const [monedaEmb, setMonedaEmb] = useState("USD");

  // Alertas
  const [diasEta, setDiasEta] = useState("7");
  const [diasEtaCritica, setDiasEtaCritica] = useState("3");
  const [diasFactVencer, setDiasFactVencer] = useState("7");

  useEffect(() => {
    if (!config) return;
    setNombre(getVal(config, "empresa", "nombre", ""));
    setSubtitulo(getVal(config, "empresa", "subtitulo", ""));
    setRfc(getVal(config, "empresa", "rfc", ""));
    setDireccion(getVal(config, "empresa", "direccion_fiscal", ""));
    setEmail(getVal(config, "empresa", "email", ""));
    setTelefono(getVal(config, "empresa", "telefono", ""));
    setUsdMxn(String(getVal(config, "tipos_cambio", "usd_mxn_default", 17.25)));
    setEurMxn(String(getVal(config, "tipos_cambio", "eur_mxn_default", 18.5)));
    setFuente(getVal(config, "tipos_cambio", "fuente", "api"));
    setVigenciaDias(String(getVal(config, "cotizaciones", "vigencia_dias", 15)));
    setDiasLibres(String(getVal(config, "cotizaciones", "dias_libres_destino", 0)));
    setMonedaCot(getVal(config, "cotizaciones", "moneda_default", "USD"));
    setTerminos(getVal(config, "cotizaciones", "terminos_condiciones", ""));
    setTasaIva(String(getVal(config, "facturacion", "tasa_iva", 16)));
    setDiasVenc(String(getVal(config, "facturacion", "dias_vencimiento", 30)));
    setSerieFact(getVal(config, "facturacion", "serie_factura", "A"));
    setFolioInicial(String(getVal(config, "facturacion", "folio_inicial", 1)));
    setMonedaFact(getVal(config, "facturacion", "moneda_default", "MXN"));
    setPrefijo(getVal(config, "embarques", "prefijo_expediente", "EXP"));
    setTipoCargaDefault(getVal(config, "embarques", "tipo_carga_default", "Carga General"));
    setMonedaEmb(getVal(config, "embarques", "moneda_default", "USD"));
    setDiasEta(String(getVal(config, "alertas", "dias_eta_alerta", 7)));
    setDiasEtaCritica(String(getVal(config, "alertas", "dias_eta_critica", 3)));
    setDiasFactVencer(String(getVal(config, "alertas", "dias_factura_vencer", 7)));
  }, [config]);

  const handleSave = () => {
    updateConfig.mutate([
      { categoria: "empresa", clave: "nombre", valor: nombre },
      { categoria: "empresa", clave: "subtitulo", valor: subtitulo },
      { categoria: "empresa", clave: "rfc", valor: rfc },
      { categoria: "empresa", clave: "direccion_fiscal", valor: direccion },
      { categoria: "empresa", clave: "email", valor: email },
      { categoria: "empresa", clave: "telefono", valor: telefono },
      { categoria: "tipos_cambio", clave: "usd_mxn_default", valor: parseFloat(usdMxn) || 17.25 },
      { categoria: "tipos_cambio", clave: "eur_mxn_default", valor: parseFloat(eurMxn) || 18.5 },
      { categoria: "tipos_cambio", clave: "fuente", valor: fuente },
      { categoria: "cotizaciones", clave: "vigencia_dias", valor: parseInt(vigenciaDias) || 15 },
      { categoria: "cotizaciones", clave: "dias_libres_destino", valor: parseInt(diasLibres) || 0 },
      { categoria: "cotizaciones", clave: "moneda_default", valor: monedaCot },
      { categoria: "cotizaciones", clave: "terminos_condiciones", valor: terminos },
      { categoria: "facturacion", clave: "tasa_iva", valor: parseInt(tasaIva) || 16 },
      { categoria: "facturacion", clave: "dias_vencimiento", valor: parseInt(diasVenc) || 30 },
      { categoria: "facturacion", clave: "serie_factura", valor: serieFact },
      { categoria: "facturacion", clave: "folio_inicial", valor: parseInt(folioInicial) || 1 },
      { categoria: "facturacion", clave: "moneda_default", valor: monedaFact },
      { categoria: "embarques", clave: "prefijo_expediente", valor: prefijo },
      { categoria: "embarques", clave: "tipo_carga_default", valor: tipoCargaDefault },
      { categoria: "embarques", clave: "moneda_default", valor: monedaEmb },
      { categoria: "alertas", clave: "dias_eta_alerta", valor: parseInt(diasEta) || 7 },
      { categoria: "alertas", clave: "dias_eta_critica", valor: parseInt(diasEtaCritica) || 3 },
      { categoria: "alertas", clave: "dias_factura_vencer", valor: parseInt(diasFactVencer) || 7 },
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
          <TabEmpresa nombre={nombre} setNombre={setNombre} subtitulo={subtitulo} setSubtitulo={setSubtitulo} rfc={rfc} setRfc={setRfc} direccion={direccion} setDireccion={setDireccion} email={email} setEmail={setEmail} telefono={telefono} setTelefono={setTelefono} />
        </TabsContent>
        <TabsContent value="tipos_cambio">
          <TabTiposCambio usdMxn={usdMxn} setUsdMxn={setUsdMxn} eurMxn={eurMxn} setEurMxn={setEurMxn} fuente={fuente} setFuente={setFuente} />
        </TabsContent>
        <TabsContent value="cotizaciones">
          <TabCotizaciones vigenciaDias={vigenciaDias} setVigenciaDias={setVigenciaDias} diasLibres={diasLibres} setDiasLibres={setDiasLibres} monedaCot={monedaCot} setMonedaCot={setMonedaCot} terminos={terminos} setTerminos={setTerminos} />
        </TabsContent>
        <TabsContent value="facturacion">
          <TabFacturacion tasaIva={tasaIva} setTasaIva={setTasaIva} diasVenc={diasVenc} setDiasVenc={setDiasVenc} serieFact={serieFact} setSerieFact={setSerieFact} folioInicial={folioInicial} setFolioInicial={setFolioInicial} monedaFact={monedaFact} setMonedaFact={setMonedaFact} />
        </TabsContent>
        <TabsContent value="embarques">
          <TabEmbarques prefijo={prefijo} setPrefijo={setPrefijo} tipoCargaDefault={tipoCargaDefault} setTipoCargaDefault={setTipoCargaDefault} monedaEmb={monedaEmb} setMonedaEmb={setMonedaEmb} />
        </TabsContent>
        <TabsContent value="alertas">
          <TabAlertas diasEta={diasEta} setDiasEta={setDiasEta} diasEtaCritica={diasEtaCritica} setDiasEtaCritica={setDiasEtaCritica} diasFactVencer={diasFactVencer} setDiasFactVencer={setDiasFactVencer} />
        </TabsContent>
        <TabsContent value="puertos">
          <TabPuertos />
        </TabsContent>
      </Tabs>
    </div>
  );
}
