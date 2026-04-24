import { useState, useMemo } from "react";
import { FileText, Download, CheckCircle2, Clock, Receipt, Trash2, Loader2, FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/uiMappings";
import { calcularIVA } from "@/lib/financialUtils";
import { useTasaIVA } from "@/hooks/useTasaIVA";
import { useEmbarqueConceptosVenta } from "@/hooks/useEmbarques";
import { useProformasEmbarque, useEliminarProforma } from "@/hooks/embarque/useProformas";
import { DialogGenerarProforma } from "./DialogGenerarProforma";
import { generarPdfProforma } from "@/generators/proformaPdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type EmbarqueRow = Tables<'embarques'>;

interface Factura {
  id: string;
  numero: string;
  total: number;
  moneda: string;
  fecha_emision: string;
  estado: string;
  proforma_id?: string | null;
  factura_pdf_url?: string | null;
  factura_xml_url?: string | null;
}

interface Props {
  facturas: Factura[];
  canEdit: boolean;
  embarque: EmbarqueRow;
}

export function TabFacturacion({ facturas, canEdit, embarque }: Props) {
  const tasaIva = useTasaIVA();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: conceptos = [] } = useEmbarqueConceptosVenta(embarque.id);
  const { data: proformas = [] } = useProformasEmbarque(embarque.id);
  const eliminarProforma = useEliminarProforma();
  const [proformaAEliminar, setProformaAEliminar] = useState<{ id: string; numero: string } | null>(null);

  const conceptosPendientes = useMemo(
    () => conceptos.filter(c => c.estado_facturacion !== 'en_proforma'),
    [conceptos]
  );
  const conceptosEnProforma = useMemo(
    () => conceptos.filter(c => c.estado_facturacion === 'en_proforma'),
    [conceptos]
  );

  // Totales por estado y moneda
  const totales = useMemo(() => {
    const sumByCurrency = (items: typeof conceptos) => {
      const usd = items.filter(c => c.moneda === 'USD');
      const mxn = items.filter(c => c.moneda === 'MXN');
      const subUsd = usd.reduce((s, c) => s + Number(c.cantidad) * Number(c.precio_unitario), 0);
      const ivaUsd = usd.reduce((s, c) => {
        const sub = Number(c.cantidad) * Number(c.precio_unitario);
        return c.aplica_iva ? s + calcularIVA(sub, tasaIva) : s;
      }, 0);
      const subMxn = mxn.reduce((s, c) => s + Number(c.cantidad) * Number(c.precio_unitario), 0);
      const ivaMxn = calcularIVA(subMxn, tasaIva);
      return { totalUsd: subUsd + ivaUsd, totalMxn: subMxn + ivaMxn };
    };
    return {
      pendiente: sumByCurrency(conceptosPendientes),
      enProforma: sumByCurrency(conceptosEnProforma),
    };
  }, [conceptosPendientes, conceptosEnProforma, tasaIva]);

  const handleDescargarProforma = async (proformaId: string) => {
    const proforma = proformas.find(p => p.id === proformaId);
    if (!proforma) return;
    const esConsolidada = !!proforma.es_consolidada;
    const [conceptosRes, clienteRes, consolidadosRes] = await Promise.all([
      esConsolidada
        ? Promise.resolve({ data: [] as any[], error: null as any })
        : supabase.from('conceptos_venta').select('*').eq('proforma_id', proformaId),
      supabase.from('clientes').select('nombre, rfc, direccion, ciudad, estado, cp').eq('id', embarque.cliente_id).maybeSingle(),
      esConsolidada
        ? supabase.from('proforma_conceptos_consolidados').select('*').eq('proforma_id', proformaId)
        : Promise.resolve({ data: [] as any[], error: null as any }),
    ]);
    if (conceptosRes.error || consolidadosRes.error) {
      toast.error('Error al cargar conceptos');
      return;
    }
    generarPdfProforma({
      proforma,
      embarque,
      conceptos: conceptosRes.data || [],
      cliente: clienteRes.data,
      tasaIva,
      conceptosConsolidados: consolidadosRes.data || [],
    });
  };

  return (
    <div className="space-y-4">
      {/* Conceptos de venta con estado */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Conceptos de Venta
          </CardTitle>
          {canEdit && conceptosPendientes.length > 0 && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <FileText className="h-4 w-4 mr-1" /> Generar Proforma
              <Badge variant="secondary" className="ml-2 bg-white/20 text-white border-0">
                {conceptosPendientes.length}
              </Badge>
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {conceptos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No hay conceptos de venta registrados. Agrega conceptos en la pestaña Costos.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">P. Unitario</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conceptos.map(c => {
                    const enProforma = c.estado_facturacion === 'en_proforma';
                    const total = Number(c.cantidad) * Number(c.precio_unitario);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.descripcion}
                          {c.moneda === 'USD' && c.aplica_iva && (
                            <Badge variant="outline" className="ml-2 text-xs bg-amber-50 text-amber-700 border-amber-200">+IVA</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{c.cantidad}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(c.precio_unitario), c.moneda)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(total, c.moneda)}</TableCell>
                        <TableCell>{c.moneda}</TableCell>
                        <TableCell>
                          {enProforma ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> En proforma
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                              <Clock className="h-3 w-3 mr-1" /> Pendiente
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Resumen totales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border-t bg-muted/30">
                <div className="rounded-md border bg-background p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-semibold">Pendiente</span>
                    <Badge variant="secondary" className="ml-auto">{conceptosPendientes.length}</Badge>
                  </div>
                  <div className="text-sm space-y-0.5">
                    {totales.pendiente.totalMxn > 0 && (
                      <div className="flex justify-between"><span className="text-muted-foreground">MXN:</span><span className="font-semibold">{formatCurrency(totales.pendiente.totalMxn, 'MXN')}</span></div>
                    )}
                    {totales.pendiente.totalUsd > 0 && (
                      <div className="flex justify-between"><span className="text-muted-foreground">USD:</span><span className="font-semibold">{formatCurrency(totales.pendiente.totalUsd, 'USD')}</span></div>
                    )}
                    {totales.pendiente.totalMxn === 0 && totales.pendiente.totalUsd === 0 && (
                      <span className="text-muted-foreground text-xs">Sin conceptos pendientes</span>
                    )}
                  </div>
                </div>
                <div className="rounded-md border border-green-200 bg-green-50/50 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-semibold">En proforma</span>
                    <Badge className="ml-auto bg-green-100 text-green-800 border-green-200">{conceptosEnProforma.length}</Badge>
                  </div>
                  <div className="text-sm space-y-0.5">
                    {totales.enProforma.totalMxn > 0 && (
                      <div className="flex justify-between"><span className="text-muted-foreground">MXN:</span><span className="font-semibold">{formatCurrency(totales.enProforma.totalMxn, 'MXN')}</span></div>
                    )}
                    {totales.enProforma.totalUsd > 0 && (
                      <div className="flex justify-between"><span className="text-muted-foreground">USD:</span><span className="font-semibold">{formatCurrency(totales.enProforma.totalUsd, 'USD')}</span></div>
                    )}
                    {totales.enProforma.totalMxn === 0 && totales.enProforma.totalUsd === 0 && (
                      <span className="text-muted-foreground text-xs">Sin proformas generadas</span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Historial de proformas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Proformas Generadas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {proformas.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              No hay proformas generadas para este embarque
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead className="text-right">Días Crédito</TableHead>
                  <TableHead className="text-right">Total USD</TableHead>
                  <TableHead className="text-right">Total MXN</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Folio Factura</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proformas.map(p => {
                  const facturada = (p.estado_proforma ?? 'pendiente') === 'facturada';
                  return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.numero}</TableCell>
                    <TableCell>{formatDate(p.fecha_emision)}</TableCell>
                    <TableCell className="text-sm">{p.operador || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right text-sm">
                      {p.dias_credito == null ? '—' : Number(p.dias_credito) === 0 ? 'Contado' : `${p.dias_credito} días`}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(p.total_usd) > 0 ? formatCurrency(Number(p.total_usd), 'USD') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(p.total_mxn) > 0 ? formatCurrency(Number(p.total_mxn), 'MXN') : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {(() => {
                          const rev = p.estado_revision ?? 'aprobada';
                          if (rev === 'pendiente') {
                            return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 w-fit">Pendiente de revisión</Badge>;
                          }
                          if (rev === 'consolidada') {
                            const consolidadaEnId = (p as any).consolidada_en as string | null;
                            const consolidadaNumero = proformas.find(x => x.id === consolidadaEnId)?.numero;
                            return (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 w-fit">
                                Consolidada{consolidadaNumero ? ` en ${consolidadaNumero}` : ''}
                              </Badge>
                            );
                          }
                          return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 w-fit">Aprobada</Badge>;
                        })()}
                        {facturada ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 w-fit">Facturada</Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 w-fit">Pago pendiente</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.folio_factura_externa
                        ? <span className="font-mono">{p.folio_factura_externa}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleDescargarProforma(p.id)}>
                          <Download className="h-3.5 w-3.5 mr-1" /> Descargar
                        </Button>
                        {p.facturas?.factura_pdf_url && (
                          <Button asChild variant="outline" size="icon" className="h-8 w-8" title="Descargar factura PDF">
                            <a href={p.facturas.factura_pdf_url} target="_blank" rel="noopener noreferrer" download>
                              <FileText className="h-3.5 w-3.5 text-red-600" />
                            </a>
                          </Button>
                        )}
                        {p.facturas?.factura_xml_url && (
                          <Button asChild variant="outline" size="icon" className="h-8 w-8" title="Descargar factura XML">
                            <a href={p.facturas.factura_xml_url} target="_blank" rel="noopener noreferrer" download>
                              <FileCode2 className="h-3.5 w-3.5 text-blue-600" />
                            </a>
                          </Button>
                        )}
                        {canEdit && !facturada && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setProformaAEliminar({ id: p.id, numero: p.numero })}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Facturas (existente) */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Facturas del Embarque</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {facturas.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead># Factura</TableHead>
                  <TableHead>Proforma</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Archivos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facturas.map(factura => {
                  const proformaNumero = factura.proforma_id
                    ? proformas.find(p => p.id === factura.proforma_id)?.numero
                    : null;
                  return (
                    <TableRow key={factura.id}>
                      <TableCell className="font-medium">{factura.numero}</TableCell>
                      <TableCell className="text-xs">
                        {proformaNumero
                          ? <span className="font-mono">{proformaNumero}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>{formatCurrency(Number(factura.total), factura.moneda)}</TableCell>
                      <TableCell>{factura.moneda}</TableCell>
                      <TableCell>{formatDate(factura.fecha_emision)}</TableCell>
                      <TableCell><Badge className={getEstadoColor(factura.estado)}>{factura.estado}</Badge></TableCell>
                      <TableCell>
                        {!factura.factura_pdf_url && !factura.factura_xml_url ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            {factura.factura_pdf_url && (
                              <a href={factura.factura_pdf_url} target="_blank" rel="noopener noreferrer" download
                                title="Descargar PDF" className="inline-flex">
                                <FileText className="h-4 w-4 text-red-600 hover:text-red-700" />
                              </a>
                            )}
                            {factura.factura_xml_url && (
                              <a href={factura.factura_xml_url} target="_blank" rel="noopener noreferrer" download
                                title="Descargar XML" className="inline-flex">
                                <FileCode2 className="h-4 w-4 text-blue-600 hover:text-blue-700" />
                              </a>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6 text-center text-muted-foreground text-sm">No hay facturas generadas para este embarque</div>
          )}
        </CardContent>
      </Card>

      <DialogGenerarProforma
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        embarque={embarque}
        conceptosPendientes={conceptosPendientes}
      />

      <AlertDialog open={!!proformaAEliminar} onOpenChange={(o) => !o && setProformaAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar proforma</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar la proforma <strong>{proformaAEliminar?.numero}</strong>? Los conceptos volverán a estado Pendiente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminarProforma.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={eliminarProforma.isPending}
              onClick={async (e) => {
                e.preventDefault();
                if (!proformaAEliminar) return;
                try {
                  await eliminarProforma.mutateAsync({
                    proformaId: proformaAEliminar.id,
                    embarqueId: embarque.id,
                    numero: proformaAEliminar.numero,
                  });
                  setProformaAEliminar(null);
                } catch {
                  // Error manejado en hook
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {eliminarProforma.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Eliminando...</>
              ) : (
                <>Eliminar</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
