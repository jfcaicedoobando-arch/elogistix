import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Building2, DollarSign, FileText, Ship, ClipboardList, Bell, Anchor, Plus, Trash2 } from "lucide-react";
import { useConfiguracion, useUpdateConfiguracion } from "@/hooks/useConfiguracion";
import { useAllPuertos, useAdminPuertos } from "@/hooks/usePuertos";
import SearchInput from "@/components/SearchInput";

function getVal<T>(data: any[] | undefined, categoria: string, clave: string, fallback: T): T {
  if (!data) return fallback;
  const item = data.find((c: any) => c.categoria === categoria && c.clave === clave);
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

  // Puertos
  const { data: puertos = [], isLoading: puertosLoading } = useAllPuertos();
  const { agregarPuerto, toggleActivo, eliminarPuerto } = useAdminPuertos();
  const [puertoBusqueda, setPuertoBusqueda] = useState("");
  const [nuevoCode, setNuevoCode] = useState("");
  const [nuevoName, setNuevoName] = useState("");
  const [nuevoCountry, setNuevoCountry] = useState("");

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

  const handleAgregarPuerto = () => {
    if (!nuevoCode.trim() || !nuevoName.trim() || !nuevoCountry.trim()) return;
    agregarPuerto.mutate(
      { code: nuevoCode.trim().toUpperCase(), name: nuevoName.trim(), country: nuevoCountry.trim() },
      { onSuccess: () => { setNuevoCode(""); setNuevoName(""); setNuevoCountry(""); } }
    );
  };

  const puertosFiltrados = puertos.filter((p) => {
    if (!puertoBusqueda) return true;
    const q = puertoBusqueda.toLowerCase();
    return p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.country.toLowerCase().includes(q);
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
          <p className="text-sm text-muted-foreground">Parámetros generales del sistema</p>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
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
          <TabsTrigger value="empresa" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Empresa
          </TabsTrigger>
          <TabsTrigger value="tipos_cambio" className="gap-1.5">
            <DollarSign className="h-3.5 w-3.5" /> Tipos de Cambio
          </TabsTrigger>
          <TabsTrigger value="cotizaciones" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Cotizaciones
          </TabsTrigger>
          <TabsTrigger value="facturacion" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Facturación
          </TabsTrigger>
          <TabsTrigger value="embarques" className="gap-1.5">
            <Ship className="h-3.5 w-3.5" /> Embarques
          </TabsTrigger>
          <TabsTrigger value="alertas" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" /> Alertas
          </TabsTrigger>
          <TabsTrigger value="puertos" className="gap-1.5">
            <Anchor className="h-3.5 w-3.5" /> Puertos
          </TabsTrigger>
        </TabsList>

        {/* EMPRESA */}
        <TabsContent value="empresa">
          <Card>
            <CardHeader>
              <CardTitle>Datos de la Empresa</CardTitle>
              <CardDescription>Información que aparece en el sistema y futuros documentos PDF</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre comercial</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Subtítulo / Giro</Label>
                <Input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>RFC</Label>
                <Input value={rfc} onChange={(e) => setRfc(e.target.value)} placeholder="XAXX010101000" />
              </div>
              <div className="space-y-2">
                <Label>Email de contacto</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Dirección fiscal</Label>
                <Textarea value={direccion} onChange={(e) => setDireccion(e.target.value)} rows={2} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TIPOS DE CAMBIO */}
        <TabsContent value="tipos_cambio">
          <Card>
            <CardHeader>
              <CardTitle>Tipos de Cambio por Defecto</CardTitle>
              <CardDescription>Valores usados cuando la API no está disponible o se elige modo manual</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>USD → MXN</Label>
                <Input type="number" step="0.01" value={usdMxn} onChange={(e) => setUsdMxn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>EUR → MXN</Label>
                <Input type="number" step="0.01" value={eurMxn} onChange={(e) => setEurMxn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fuente de tipos de cambio</Label>
                <Select value={fuente} onValueChange={setFuente}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api">API automática (frankfurter.app)</SelectItem>
                    <SelectItem value="manual">Manual (usar valores por defecto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COTIZACIONES */}
        <TabsContent value="cotizaciones">
          <Card>
            <CardHeader>
              <CardTitle>Parámetros de Cotizaciones</CardTitle>
              <CardDescription>Valores predeterminados al crear nuevas cotizaciones</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vigencia por defecto (días)</Label>
                <Input type="number" value={vigenciaDias} onChange={(e) => setVigenciaDias(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Días libres en destino</Label>
                <Input type="number" value={diasLibres} onChange={(e) => setDiasLibres(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Moneda predeterminada</Label>
                <Select value={monedaCot} onValueChange={setMonedaCot}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MXN">MXN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Términos y condiciones</Label>
                <Textarea value={terminos} onChange={(e) => setTerminos(e.target.value)} rows={4} placeholder="Texto que aparecerá al pie de las cotizaciones..." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FACTURACIÓN */}
        <TabsContent value="facturacion">
          <Card>
            <CardHeader>
              <CardTitle>Parámetros de Facturación</CardTitle>
              <CardDescription>Configuración para la emisión de facturas</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tasa de IVA (%)</Label>
                <Input type="number" value={tasaIva} onChange={(e) => setTasaIva(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Días de vencimiento</Label>
                <Input type="number" value={diasVenc} onChange={(e) => setDiasVenc(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Serie de factura</Label>
                <Input value={serieFact} onChange={(e) => setSerieFact(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Folio inicial</Label>
                <Input type="number" value={folioInicial} onChange={(e) => setFolioInicial(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Moneda predeterminada</Label>
                <Select value={monedaFact} onValueChange={setMonedaFact}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MXN">MXN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EMBARQUES */}
        <TabsContent value="embarques">
          <Card>
            <CardHeader>
              <CardTitle>Parámetros de Embarques</CardTitle>
              <CardDescription>Valores predeterminados para nuevos embarques</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Prefijo de expediente</Label>
                <Input value={prefijo} onChange={(e) => setPrefijo(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de carga por defecto</Label>
                <Select value={tipoCargaDefault} onValueChange={setTipoCargaDefault}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Carga General">Carga General</SelectItem>
                    <SelectItem value="Mercancía Peligrosa">Mercancía Peligrosa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Moneda predeterminada</Label>
                <Select value={monedaEmb} onValueChange={setMonedaEmb}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MXN">MXN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ALERTAS */}
        <TabsContent value="alertas">
          <Card>
            <CardHeader>
              <CardTitle>Umbrales de Alertas</CardTitle>
              <CardDescription>Configuración de las alertas del Dashboard</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Días antes de ETA (alerta general)</Label>
                <Input type="number" value={diasEta} onChange={(e) => setDiasEta(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Días antes de ETA (alerta crítica)</Label>
                <Input type="number" value={diasEtaCritica} onChange={(e) => setDiasEtaCritica(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Días antes de vencimiento de factura</Label>
                <Input type="number" value={diasFactVencer} onChange={(e) => setDiasFactVencer(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PUERTOS */}
        <TabsContent value="puertos">
          <Card>
            <CardHeader>
              <CardTitle>Catálogo de Puertos</CardTitle>
              <CardDescription>Administra los puertos disponibles en cotizaciones y embarques. Desactiva los que no uses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Agregar nuevo */}
              <div className="flex flex-wrap gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Código</Label>
                  <Input className="w-28" placeholder="MXZLO" value={nuevoCode} onChange={(e) => setNuevoCode(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nombre</Label>
                  <Input className="w-48" placeholder="Manzanillo" value={nuevoName} onChange={(e) => setNuevoName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">País</Label>
                  <Input className="w-40" placeholder="México" value={nuevoCountry} onChange={(e) => setNuevoCountry(e.target.value)} />
                </div>
                <Button size="sm" onClick={handleAgregarPuerto} disabled={agregarPuerto.isPending}>
                  <Plus className="h-4 w-4 mr-1" /> Agregar
                </Button>
              </div>

              {/* Buscador */}
              <SearchInput value={puertoBusqueda} onChange={setPuertoBusqueda} placeholder="Buscar por código, nombre o país..." />

              {/* Tabla */}
              {puertosLoading ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <div className="max-h-[500px] overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>País</TableHead>
                        <TableHead className="text-center">Activo</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {puertosFiltrados.map((p) => (
                        <TableRow key={p.id} className={!p.activo ? "opacity-50" : ""}>
                          <TableCell className="font-mono text-xs">{p.code}</TableCell>
                          <TableCell>{p.name}</TableCell>
                          <TableCell>{p.country}</TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={p.activo}
                              onCheckedChange={(checked) => toggleActivo.mutate({ id: p.id, activo: checked })}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => eliminarPuerto.mutate(p.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {puertosFiltrados.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No se encontraron puertos
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">{puertos.length} puertos en total · {puertos.filter(p => p.activo).length} activos</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
