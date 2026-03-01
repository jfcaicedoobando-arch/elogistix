import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import {
  useEmbarque,
  useEmbarqueConceptosVenta,
  useEmbarqueConceptosCosto,
  useEmbarqueDocumentos,
  useEmbarqueNotas,
  useEmbarqueFacturas,
} from "@/hooks/useEmbarques";

const estadoTimeline = ['Cotización', 'Confirmado', 'En Tránsito', 'Llegada', 'En Proceso', 'Cerrado'];

const getModoIcon = (modo: string) => {
  switch (modo) {
    case 'Marítimo': return '🚢';
    case 'Aéreo': return '✈️';
    case 'Terrestre': return '🚛';
    default: return '📦';
  }
};

const getEstadoColor = (estado: string) => {
  switch (estado) {
    case 'Cotización': return 'bg-muted text-muted-foreground';
    case 'Confirmado': return 'bg-info/20 text-info';
    case 'En Tránsito': return 'bg-warning/20 text-warning';
    case 'Llegada': return 'bg-success/20 text-success';
    case 'En Proceso': return 'bg-accent/20 text-accent';
    case 'Cerrado': return 'bg-muted text-muted-foreground';
    case 'Pagado': return 'bg-success/20 text-success';
    case 'Pendiente': return 'bg-warning/20 text-warning';
    default: return '';
  }
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function EmbarqueDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: embarque, isLoading } = useEmbarque(id);
  const { data: conceptosVenta = [] } = useEmbarqueConceptosVenta(id);
  const { data: conceptosCosto = [] } = useEmbarqueConceptosCosto(id);
  const { data: documentos = [] } = useEmbarqueDocumentos(id);
  const { data: notas = [] } = useEmbarqueNotas(id);
  const { data: facturas = [] } = useEmbarqueFacturas(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!embarque) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Embarque no encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/embarques")}>Volver</Button>
      </div>
    );
  }

  const tcUSD = Number(embarque.tipo_cambio_usd) || 1;
  const tcEUR = Number(embarque.tipo_cambio_eur) || 1;

  const totalVenta = conceptosVenta.reduce((sum, c) => {
    const t = Number(c.total);
    if (c.moneda === 'USD') return sum + t * tcUSD;
    if (c.moneda === 'EUR') return sum + t * tcEUR;
    return sum + t;
  }, 0);
  const totalCosto = conceptosCosto.reduce((sum, c) => {
    const m = Number(c.monto);
    if (c.moneda === 'USD') return sum + m * tcUSD;
    if (c.moneda === 'EUR') return sum + m * tcEUR;
    return sum + m;
  }, 0);
  const utilidad = totalVenta - totalCosto;
  const margen = totalVenta > 0 ? (utilidad / totalVenta) * 100 : 0;
  const currentStepIndex = estadoTimeline.indexOf(embarque.estado);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/embarques")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{embarque.expediente}</h1>
            <Badge className={getEstadoColor(embarque.estado)}>{embarque.estado}</Badge>
            <span className="text-lg">{getModoIcon(embarque.modo)}</span>
          </div>
          <p className="text-sm text-muted-foreground">{embarque.cliente_nombre}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Edit className="h-4 w-4 mr-1" /> Editar</Button>
          <Button variant="outline" size="sm"><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
        </div>
      </div>

      <Tabs defaultValue="resumen">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="costos">Costos</TabsTrigger>
          <TabsTrigger value="facturacion">Facturación</TabsTrigger>
          <TabsTrigger value="notas">Notas y Actividad</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                {estadoTimeline.map((estado, i) => (
                  <div key={estado} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        i <= currentStepIndex ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                      }`}>{i + 1}</div>
                      <span className={`text-[10px] mt-1 text-center ${i <= currentStepIndex ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{estado}</span>
                    </div>
                    {i < estadoTimeline.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 ${i < currentStepIndex ? 'bg-accent' : 'bg-border'}`} />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Datos Generales</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Modo" value={`${getModoIcon(embarque.modo)} ${embarque.modo}`} />
                <Row label="Tipo" value={embarque.tipo} />
                <Row label="Incoterm" value={embarque.incoterm} />
                <Row label="Mercancía" value={embarque.descripcion_mercancia} />
                <Row label="Peso" value={`${Number(embarque.peso_kg).toLocaleString()} kg`} />
                <Row label="Volumen" value={`${embarque.volumen_m3} m³`} />
                <Row label="Piezas" value={embarque.piezas.toString()} />
                <Row label="Operador" value={embarque.operador} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Ruta y Transporte</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {embarque.modo === 'Marítimo' && (<>
                  <Row label="Puerto Origen" value={embarque.puerto_origen || '-'} />
                  <Row label="Puerto Destino" value={embarque.puerto_destino || '-'} />
                  <Row label="Naviera" value={embarque.naviera || '-'} />
                  <Row label="BL Master" value={embarque.bl_master || '-'} />
                  <Row label="BL House" value={embarque.bl_house || '-'} />
                  <Row label="Servicio" value={embarque.tipo_servicio || '-'} />
                  <Row label="Contenedor" value={`${embarque.contenedor || '-'} (${embarque.tipo_contenedor || '-'})`} />
                </>)}
                {embarque.modo === 'Aéreo' && (<>
                  <Row label="Aeropuerto Origen" value={embarque.aeropuerto_origen || '-'} />
                  <Row label="Aeropuerto Destino" value={embarque.aeropuerto_destino || '-'} />
                  <Row label="Aerolínea" value={embarque.aerolinea || '-'} />
                  <Row label="MAWB" value={embarque.mawb || '-'} />
                  <Row label="HAWB" value={embarque.hawb || '-'} />
                </>)}
                {embarque.modo === 'Terrestre' && (<>
                  <Row label="Ciudad Origen" value={embarque.ciudad_origen || '-'} />
                  <Row label="Ciudad Destino" value={embarque.ciudad_destino || '-'} />
                  <Row label="Transportista" value={embarque.transportista || '-'} />
                  <Row label="Carta Porte" value={embarque.carta_porte || '-'} />
                </>)}
                <Row label="ETD" value={formatDate(embarque.etd)} />
                <Row label="ETA" value={formatDate(embarque.eta)} />
                {embarque.fecha_llegada_real && <Row label="Llegada Real" value={formatDate(embarque.fecha_llegada_real)} />}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Shipper</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">{embarque.shipper}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Consignatario</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">{embarque.consignatario}</CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="documentos">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentos.map(doc => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.nombre}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${
                            doc.estado === 'Validado' ? 'bg-success' : doc.estado === 'Recibido' ? 'bg-warning' : 'bg-destructive'
                          }`} />
                          <span className="text-sm">{doc.estado}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{doc.notas || '-'}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">Subir archivo</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {documentos.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">Sin documentos registrados</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costos" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Venta</p><p className="text-lg font-bold">{formatCurrency(totalVenta)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Costo</p><p className="text-lg font-bold">{formatCurrency(totalCosto)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Utilidad</p><p className={`text-lg font-bold ${utilidad >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(utilidad)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Margen</p><p className={`text-lg font-bold ${margen >= 0 ? 'text-success' : 'text-destructive'}`}>{margen.toFixed(1)}%</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Conceptos de Venta</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Concepto</TableHead><TableHead>Cant.</TableHead><TableHead>P. Unitario</TableHead><TableHead>Moneda</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {conceptosVenta.map(c => (
                    <TableRow key={c.id}><TableCell>{c.descripcion}</TableCell><TableCell>{c.cantidad}</TableCell><TableCell>{formatCurrency(Number(c.precio_unitario), c.moneda)}</TableCell><TableCell>{c.moneda}</TableCell><TableCell className="font-medium">{formatCurrency(Number(c.total), c.moneda)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Conceptos de Costo</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Proveedor</TableHead><TableHead>Concepto</TableHead><TableHead>Monto</TableHead><TableHead>Moneda</TableHead><TableHead>Liquidación</TableHead></TableRow></TableHeader>
                <TableBody>
                  {conceptosCosto.map(c => (
                    <TableRow key={c.id}><TableCell>{c.proveedor_nombre}</TableCell><TableCell>{c.concepto}</TableCell><TableCell className="font-medium">{formatCurrency(Number(c.monto), c.moneda)}</TableCell><TableCell>{c.moneda}</TableCell>
                      <TableCell><Badge className={getEstadoColor(c.estado_liquidacion)}>{c.estado_liquidacion}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="facturacion">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Facturas del Embarque</CardTitle>
              <Button size="sm"><FileText className="h-4 w-4 mr-1" /> Generar Factura</Button>
            </CardHeader>
            <CardContent className="p-0">
              {facturas.length > 0 ? (
                <Table>
                  <TableHeader><TableRow><TableHead># Factura</TableHead><TableHead>Monto</TableHead><TableHead>Moneda</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {facturas.map(f => (
                      <TableRow key={f.id}><TableCell className="font-medium">{f.numero}</TableCell><TableCell>{formatCurrency(Number(f.total), f.moneda)}</TableCell><TableCell>{f.moneda}</TableCell><TableCell>{formatDate(f.fecha_emision)}</TableCell>
                        <TableCell><Badge className={getEstadoColor(f.estado)}>{f.estado}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-muted-foreground text-sm">No hay facturas generadas para este embarque</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notas">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Actividad y Notas</CardTitle></CardHeader>
            <CardContent>
              {notas.length > 0 ? (
                <div className="space-y-4">
                  {notas.map(n => (
                    <div key={n.id} className="flex gap-3 text-sm">
                      <div className="flex flex-col items-center">
                        <div className={`h-2.5 w-2.5 rounded-full mt-1.5 ${
                          n.tipo === 'cambio_estado' ? 'bg-accent' : n.tipo === 'nota' ? 'bg-warning' : 'bg-muted-foreground'
                        }`} />
                        <div className="flex-1 w-px bg-border mt-1" />
                      </div>
                      <div className="pb-4">
                        <p className="font-medium">{n.contenido}</p>
                        <p className="text-xs text-muted-foreground">{n.usuario} · {formatDate(n.fecha)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Sin actividad registrada</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
