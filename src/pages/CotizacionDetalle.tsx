import { useState, useMemo } from "react";
import SeccionCostosInternosPL from "@/components/cotizacion/SeccionCostosInternosPL";
import type { ConceptoVentaCotizacion } from "@/hooks/useCotizaciones";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  useCotizacion, useUpdateEstadoCotizacion,
  useConvertirProspectoACliente,
  DimensionLCL, DimensionAerea,
} from "@/hooks/useCotizaciones";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { formatDate, getEstadoColor } from "@/lib/helpers";
import { formatCurrency } from "@/lib/formatters";
import { getSignedUrl } from "@/lib/storage";
import { ArrowLeft, CheckCircle, Send, XCircle, UserPlus, FileDown, AlertTriangle } from "lucide-react";
import { generarPdfCotizacion } from "@/lib/cotizacionPdf";

export default function CotizacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: cotizacion, isLoading } = useCotizacion(id);
  const actualizarEstado = useUpdateEstadoCotizacion();
  const convertirProspecto = useConvertirProspectoACliente();
  const { canEdit } = usePermissions();

  const [showConvertir, setShowConvertir] = useState(false);
  const [clienteForm, setClienteForm] = useState({
    nombre: '', contacto: '', email: '', telefono: '',
    rfc: '', direccion: '', ciudad: '', estado: '', cp: '',
  });

  const conceptosVentaUSD = useMemo(() =>
    cotizacion ? (cotizacion.conceptos_venta as unknown as ConceptoVentaCotizacion[]).filter(c => c.moneda === 'USD') : [], [cotizacion]);
  const conceptosVentaMXN = useMemo(() =>
    cotizacion ? (cotizacion.conceptos_venta as unknown as ConceptoVentaCotizacion[]).filter(c => c.moneda === 'MXN') : [], [cotizacion]);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!cotizacion) {
    return <div className="text-center py-12 text-muted-foreground">Cotización no encontrada</div>;
  }

  const esBorradorOEnviada = cotizacion.estado === 'Borrador' || cotizacion.estado === 'Enviada';
  const esAceptada = cotizacion.estado === 'Aceptada';
  const esMaritimo = cotizacion.modo === 'Marítimo';
  const esAereo = cotizacion.modo === 'Aéreo';

  const handleCambiarEstado = async (estado: string) => {
    try {
      await actualizarEstado.mutateAsync({ id: cotizacion.id, estado });
      toast({ title: `Estado actualizado a "${estado}"` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const abrirDialogConvertir = () => {
    setClienteForm({
      nombre: cotizacion.prospecto_empresa || '',
      contacto: cotizacion.prospecto_contacto || '',
      email: cotizacion.prospecto_email || '',
      telefono: cotizacion.prospecto_telefono || '',
      rfc: '', direccion: '', ciudad: '', estado: '', cp: '',
    });
    setShowConvertir(true);
  };

  const handleConvertir = async () => {
    if (!clienteForm.nombre.trim()) {
      toast({ title: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    try {
      const cliente = await convertirProspecto.mutateAsync({
        cotizacionId: cotizacion.id,
        clienteData: clienteForm,
      });
      toast({ title: `Cliente "${cliente.nombre}" creado exitosamente` });
      setShowConvertir(false);
    } catch (err: any) {
      toast({ title: "Error al convertir prospecto", description: err.message, variant: "destructive" });
    }
  };

  const nombreDestinatario = cotizacion.es_prospecto
    ? `${cotizacion.prospecto_empresa} (Prospecto)`
    : cotizacion.cliente_nombre;

  const dimensiones: DimensionLCL[] = Array.isArray(cotizacion.dimensiones_lcl) ? cotizacion.dimensiones_lcl : [];
  const dimensionesAereas: DimensionAerea[] = Array.isArray(cotizacion.dimensiones_aereas) ? cotizacion.dimensiones_aereas : [];


  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/cotizaciones")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{cotizacion.folio}</h1>
          <p className="text-sm text-muted-foreground">{nombreDestinatario}</p>
        </div>
        <Badge className={getEstadoColor(cotizacion.estado)}>{cotizacion.estado}</Badge>
        <Button variant="outline" size="sm" onClick={() => generarPdfCotizacion(cotizacion)}>
          <FileDown className="h-4 w-4 mr-1" /> Exportar PDF
        </Button>
      </div>

      {/* Acciones según estado */}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {cotizacion.estado === 'Borrador' && (
            <Button variant="outline" size="sm" onClick={() => handleCambiarEstado('Enviada')}>
              <Send className="h-4 w-4 mr-1" /> Marcar como Enviada
            </Button>
          )}
          {esBorradorOEnviada && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleCambiarEstado('Rechazada')}>
                <XCircle className="h-4 w-4 mr-1" /> Rechazar
              </Button>
              <Button size="sm" onClick={() => handleCambiarEstado('Aceptada')}>
                <CheckCircle className="h-4 w-4 mr-1" /> Aceptar
              </Button>
            </>
          )}
          {esAceptada && cotizacion.es_prospecto && (
            <Button size="sm" variant="secondary" onClick={abrirDialogConvertir}>
              <UserPlus className="h-4 w-4 mr-1" /> Convertir a Cliente
            </Button>
          )}
        </div>
      )}

      {/* Info de prospecto */}
      {cotizacion.es_prospecto && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-amber-800 mb-2">Datos del Prospecto</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-amber-600">Empresa</span><p className="font-medium text-amber-900">{cotizacion.prospecto_empresa}</p></div>
              <div><span className="text-amber-600">Contacto</span><p className="font-medium text-amber-900">{cotizacion.prospecto_contacto}</p></div>
              <div><span className="text-amber-600">Email</span><p className="font-medium text-amber-900">{cotizacion.prospecto_email || '-'}</p></div>
              <div><span className="text-amber-600">Teléfono</span><p className="font-medium text-amber-900">{cotizacion.prospecto_telefono || '-'}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Datos generales */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Datos Generales</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">Modo</span><p className="font-medium">{cotizacion.modo}</p></div>
            <div><span className="text-muted-foreground">Tipo</span><p className="font-medium">{cotizacion.tipo}</p></div>
            <div><span className="text-muted-foreground">Incoterm</span><p className="font-medium">{cotizacion.incoterm}</p></div>
            <div><span className="text-muted-foreground">Origen</span><p className="font-medium">{cotizacion.origen || '-'}</p></div>
            <div><span className="text-muted-foreground">Destino</span><p className="font-medium">{cotizacion.destino || '-'}</p></div>
            <div><span className="text-muted-foreground">Vigencia</span><p className="font-medium">{cotizacion.vigencia_dias} días ({cotizacion.fecha_vigencia ? formatDate(cotizacion.fecha_vigencia) : '-'})</p></div>
            <div><span className="text-muted-foreground">Operador</span><p className="font-medium">{cotizacion.operador || '-'}</p></div>
            {cotizacion.tiempo_transito_dias != null && (
              <div><span className="text-muted-foreground">Tiempo de tránsito</span><p className="font-medium">{cotizacion.tiempo_transito_dias} días</p></div>
            )}
            {esMaritimo && cotizacion.tipo_embarque === 'FCL' && cotizacion.dias_libres_destino > 0 && (
              <div><span className="text-muted-foreground">Días libres en destino</span><p className="font-medium">{cotizacion.dias_libres_destino} días</p></div>
            )}
            {esMaritimo && cotizacion.tipo_embarque === 'FCL' && (
              <div><span className="text-muted-foreground">Carta garantía</span><p className="font-medium">{cotizacion.carta_garantia ? 'Sí' : 'No'}</p></div>
            )}
            {esMaritimo && cotizacion.tipo_embarque === 'LCL' && cotizacion.dias_almacenaje > 0 && (
              <div><span className="text-muted-foreground">Días libres de almacenaje</span><p className="font-medium">{cotizacion.dias_almacenaje} días</p></div>
            )}
            {cotizacion.frecuencia && (
              <div><span className="text-muted-foreground">Frecuencia</span><p className="font-medium">{cotizacion.frecuencia}</p></div>
            )}
            {cotizacion.ruta_texto && (
              <div className="col-span-2"><span className="text-muted-foreground">Ruta</span><p className="font-medium">{cotizacion.ruta_texto}</p></div>
            )}
            {cotizacion.validez_propuesta && (
              <div><span className="text-muted-foreground">Validez propuesta</span><p className="font-medium">{formatDate(cotizacion.validez_propuesta)}</p></div>
            )}
            {cotizacion.tipo_movimiento && (
              <div><span className="text-muted-foreground">Tipo de movimiento</span><p className="font-medium">{cotizacion.tipo_movimiento}</p></div>
            )}
            <div><span className="text-muted-foreground">Seguro</span><p className="font-medium">{cotizacion.seguro ? `Sí — $${Number(cotizacion.valor_seguro_usd || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} USD` : 'No'}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Mercancía */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Mercancía</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {esMaritimo && (
              <div>
                <span className="text-muted-foreground">Tipo de Embarque</span>
                <p className="font-medium">{cotizacion.tipo_embarque}</p>
              </div>
            )}
            {esMaritimo && cotizacion.tipo_embarque === 'FCL' && (
              <>
                <div>
                  <span className="text-muted-foreground">Tipo de Contenedor</span>
                  <p className="font-medium">{cotizacion.tipo_contenedor || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Peso</span>
                  <p className="font-medium">{cotizacion.tipo_peso}</p>
                </div>
              </>
            )}
            <div>
              <span className="text-muted-foreground">Tipo de Carga</span>
              <p className="font-medium flex items-center gap-1">
                {cotizacion.tipo_carga === 'Mercancía Peligrosa' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                {cotizacion.tipo_carga || 'Carga General'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Sector Económico</span>
              <p className="font-medium">{cotizacion.sector_economico || cotizacion.descripcion_mercancia || '-'}</p>
            </div>
            {!esMaritimo && !esAereo && (
              <>
                <div><span className="text-muted-foreground">Peso</span><p className="font-medium">{cotizacion.peso_kg} kg</p></div>
                <div><span className="text-muted-foreground">Volumen</span><p className="font-medium">{cotizacion.volumen_m3} m³</p></div>
                <div><span className="text-muted-foreground">Piezas</span><p className="font-medium">{cotizacion.piezas}</p></div>
              </>
            )}
            {cotizacion.msds_archivo && (
              <div>
                <span className="text-muted-foreground">MSDS</span>
                <Button
                  variant="link" size="sm" className="p-0 h-auto text-sm"
                  onClick={async () => {
                    const url = await getSignedUrl(cotizacion.msds_archivo!);
                    window.open(url, '_blank');
                  }}
                >
                  <FileDown className="h-3 w-3 mr-1" /> Descargar
                </Button>
              </div>
            )}
          </div>

          {cotizacion.descripcion_adicional && (
            <div className="text-sm">
              <span className="text-muted-foreground">Descripción Adicional</span>
              <p className="font-medium whitespace-pre-wrap">{cotizacion.descripcion_adicional}</p>
            </div>
          )}

          {/* Tabla dimensiones LCL */}
          {esMaritimo && cotizacion.tipo_embarque === 'LCL' && dimensiones.length > 0 && (
            <div>
              <span className="text-sm text-muted-foreground font-semibold">Dimensiones</span>
              <div className="border rounded-md overflow-auto mt-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Piezas</TableHead>
                      <TableHead>Alto (cm)</TableHead>
                      <TableHead>Largo (cm)</TableHead>
                      <TableHead>Ancho (cm)</TableHead>
                      <TableHead>Volumen m³</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dimensiones.map((dimension, indice) => (
                      <TableRow key={indice}>
                        <TableCell>{dimension.piezas}</TableCell>
                        <TableCell>{dimension.alto_cm}</TableCell>
                        <TableCell>{dimension.largo_cm}</TableCell>
                        <TableCell>{dimension.ancho_cm}</TableCell>
                        <TableCell>{dimension.volumen_m3.toFixed(4)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-6 mt-2 text-sm font-semibold">
                <span>Total piezas: {cotizacion.piezas}</span>
                <span>Volumen total: {cotizacion.volumen_m3} m³</span>
              </div>
            </div>
          )}

          {/* Tabla dimensiones Aéreas */}
          {esAereo && dimensionesAereas.length > 0 && (
            <div>
              <span className="text-sm text-muted-foreground font-semibold">Dimensiones</span>
              <div className="border rounded-md overflow-auto mt-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Piezas</TableHead>
                      <TableHead>Alto (cm)</TableHead>
                      <TableHead>Largo (cm)</TableHead>
                      <TableHead>Ancho (cm)</TableHead>
                      <TableHead>Peso vol. (kg)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dimensionesAereas.map((dimension, indice) => (
                      <TableRow key={indice}>
                        <TableCell>{dimension.piezas}</TableCell>
                        <TableCell>{dimension.alto_cm}</TableCell>
                        <TableCell>{dimension.largo_cm}</TableCell>
                        <TableCell>{dimension.ancho_cm}</TableCell>
                        <TableCell>{dimension.peso_volumetrico_kg.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-6 mt-2 text-sm font-semibold">
                <span>Total piezas: {cotizacion.piezas}</span>
                <span>Peso volumétrico total: {cotizacion.peso_kg} kg</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conceptos de venta — USD */}
      {(() => {
        const cUSD = cotizacion.conceptos_venta.filter(c => c.moneda === 'USD');
        const cMXN = cotizacion.conceptos_venta.filter(c => c.moneda === 'MXN');
        const tUSD = cUSD.reduce((s, c) => s + c.total, 0);
        const sMXN = cMXN.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0);
        const iMXN = sMXN * 0.16;
        const tMXN = sMXN + iMXN;
        return (
          <>
            {cUSD.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-lg">Conceptos en USD</CardTitle></CardHeader>
                <CardContent>
                  <div className="border rounded-md overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Precio Unitario</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cUSD.map((concepto, indice) => (
                          <TableRow key={indice}>
                            <TableCell>{concepto.descripcion}</TableCell>
                            <TableCell className="text-right">{concepto.cantidad}</TableCell>
                            <TableCell className="text-right">{formatCurrency(concepto.precio_unitario, 'USD')}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(concepto.total, 'USD')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex justify-end mt-3">
                    <p className="text-lg font-bold">Total USD: {formatCurrency(tUSD, 'USD')}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {cMXN.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-lg">Conceptos en MXN + IVA</CardTitle></CardHeader>
                <CardContent>
                  <div className="border rounded-md overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">P. Unitario</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                          <TableHead className="text-right">IVA (16%)</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cMXN.map((concepto, indice) => {
                          const sub = concepto.cantidad * concepto.precio_unitario;
                          const iva = sub * 0.16;
                          return (
                            <TableRow key={indice}>
                              <TableCell>{concepto.descripcion}</TableCell>
                              <TableCell className="text-right">{concepto.cantidad}</TableCell>
                              <TableCell className="text-right">{formatCurrency(concepto.precio_unitario, 'MXN')}</TableCell>
                              <TableCell className="text-right">{formatCurrency(sub, 'MXN')}</TableCell>
                              <TableCell className="text-right">{formatCurrency(iva, 'MXN')}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(sub + iva, 'MXN')}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-col items-end mt-3 gap-1">
                    <span className="text-sm">Subtotal MXN: {formatCurrency(sMXN, 'MXN')}</span>
                    <span className="text-sm">IVA (16%): {formatCurrency(iMXN, 'MXN')}</span>
                    <p className="text-lg font-bold">Total MXN: {formatCurrency(tMXN, 'MXN')}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-col items-end gap-1 p-4 border rounded-md bg-muted/30">
              <span className="text-base font-bold">Total USD: {formatCurrency(tUSD, 'USD')}</span>
              <span className="text-base font-bold">Total MXN (c/IVA): {formatCurrency(tMXN, 'MXN')}</span>
              <span className="text-xs text-muted-foreground">* Los conceptos en MXN incluyen IVA 16%</span>
            </div>
          </>
        );
      })()}

      {/* Costos Internos P&L */}
      {canEdit && (
        <SeccionCostosInternosPL
          cotizacionId={cotizacion.id}
          conceptosUSD={conceptosVentaUSD}
          conceptosMXN={conceptosVentaMXN}
        />
      )}

      {/* Notas */}
      {cotizacion.notas && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Notas</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{cotizacion.notas}</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog Convertir Prospecto */}
      <Dialog open={showConvertir} onOpenChange={setShowConvertir}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Convertir Prospecto a Cliente</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nombre / Empresa *</Label><Input value={clienteForm.nombre} onChange={e => setClienteForm(p => ({ ...p, nombre: e.target.value }))} /></div>
            <div><Label>Contacto *</Label><Input value={clienteForm.contacto} onChange={e => setClienteForm(p => ({ ...p, contacto: e.target.value }))} /></div>
            <div><Label>Email</Label><Input value={clienteForm.email} onChange={e => setClienteForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div><Label>Teléfono</Label><Input value={clienteForm.telefono} onChange={e => setClienteForm(p => ({ ...p, telefono: e.target.value }))} /></div>
            <div><Label>RFC</Label><Input value={clienteForm.rfc} onChange={e => setClienteForm(p => ({ ...p, rfc: e.target.value }))} /></div>
            <div className="col-span-2"><Label>Dirección</Label><Input value={clienteForm.direccion} onChange={e => setClienteForm(p => ({ ...p, direccion: e.target.value }))} /></div>
            <div><Label>Ciudad</Label><Input value={clienteForm.ciudad} onChange={e => setClienteForm(p => ({ ...p, ciudad: e.target.value }))} /></div>
            <div><Label>Estado</Label><Input value={clienteForm.estado} onChange={e => setClienteForm(p => ({ ...p, estado: e.target.value }))} /></div>
            <div><Label>C.P.</Label><Input value={clienteForm.cp} onChange={e => setClienteForm(p => ({ ...p, cp: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertir(false)}>Cancelar</Button>
            <Button onClick={handleConvertir} disabled={convertirProspecto.isPending}>
              {convertirProspecto.isPending ? 'Creando...' : 'Crear Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
