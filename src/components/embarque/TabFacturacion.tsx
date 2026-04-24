import { useState, useMemo } from "react";
import { FileText, Download, CheckCircle2, Clock, Receipt, Trash2, Loader2 } from "lucide-react";
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
    // Cargar conceptos y cliente en paralelo
    const [conceptosRes, clienteRes] = await Promise.all([
      supabase.from('conceptos_venta').select('*').eq('proforma_id', proformaId),
      supabase.from('clientes').select('nombre, rfc, direccion, ciudad, estado, cp').eq('id', embarque.cliente_id).maybeSingle(),
    ]);
    if (conceptosRes.error) {
      toast.error('Error al cargar conceptos');
      return;
    }
    generarPdfProforma({
      proforma,
      embarque,
      conceptos: conceptosRes.data || [],
      cliente: clienteRes.data,
      tasaIva,
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
                  <TableHead className="text-right">Total USD</TableHead>
                  <TableHead className="text-right">Total MXN</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proformas.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.numero}</TableCell>
                    <TableCell>{formatDate(p.fecha_emision)}</TableCell>
                    <TableCell className="text-right">
                      {Number(p.total_usd) > 0 ? formatCurrency(Number(p.total_usd), 'USD') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(p.total_mxn) > 0 ? formatCurrency(Number(p.total_mxn), 'MXN') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleDescargarProforma(p.id)}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Descargar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
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
                  <TableHead>Monto</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facturas.map(factura => (
                  <TableRow key={factura.id}>
                    <TableCell className="font-medium">{factura.numero}</TableCell>
                    <TableCell>{formatCurrency(Number(factura.total), factura.moneda)}</TableCell>
                    <TableCell>{factura.moneda}</TableCell>
                    <TableCell>{formatDate(factura.fecha_emision)}</TableCell>
                    <TableCell><Badge className={getEstadoColor(factura.estado)}>{factura.estado}</Badge></TableCell>
                  </TableRow>
                ))}
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
    </div>
  );
}
