import { useState } from "react";
import { FileText, Download, XCircle, Trash2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/uiMappings";
import { useProformasEmbarque, useCancelarProforma, useEliminarProforma, type ProformaRow } from "@/hooks/useProformas";
import { generarPdfProforma } from "@/generators/proformaPdf";
import { DialogGenerarProforma } from "./DialogGenerarProforma";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

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
  embarqueId: string;
  expediente: string;
  clienteId: string | null;
  clienteNombre: string;
  conceptosVenta: Tables<'conceptos_venta'>[];
}

function getEstadoProformaColor(estado: string) {
  switch (estado) {
    case 'Pendiente': return 'bg-amber-100 text-amber-700 border-amber-300';
    case 'Facturada': return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    case 'Cancelada': return 'bg-gray-100 text-gray-700 border-gray-300';
    default: return '';
  }
}

export function TabFacturacion({
  facturas, canEdit, embarqueId, expediente, clienteId, clienteNombre, conceptosVenta,
}: Props) {
  const { toast } = useToast();
  const [dialogProforma, setDialogProforma] = useState(false);
  const { data: proformas = [] } = useProformasEmbarque(embarqueId);
  const cancelar = useCancelarProforma();
  const eliminar = useEliminarProforma();

  const handleCancelar = (p: ProformaRow) => {
    if (!confirm(`¿Cancelar la proforma ${p.numero}?`)) return;
    cancelar.mutate(p.id, {
      onSuccess: () => toast({ title: "Proforma cancelada" }),
      onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  };

  const handleEliminar = (p: ProformaRow) => {
    if (!confirm(`¿Eliminar definitivamente la proforma ${p.numero}? Esta acción no se puede deshacer.`)) return;
    eliminar.mutate(p.id, {
      onSuccess: () => toast({ title: "Proforma eliminada" }),
      onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      {/* PROFORMAS */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Proformas
          </CardTitle>
          {canEdit && (
            <Button size="sm" onClick={() => setDialogProforma(true)}>
              <FileText className="h-4 w-4 mr-1" /> Generar Proforma
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {proformas.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead># Proforma</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Folio Externo</TableHead>
                  <TableHead className="w-[140px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proformas.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.numero}</TableCell>
                    <TableCell>{formatCurrency(Number(p.total), p.moneda)}</TableCell>
                    <TableCell>{p.moneda}</TableCell>
                    <TableCell className="text-xs">{formatDate(p.created_at.substring(0, 10))}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getEstadoProformaColor(p.estado)}>{p.estado}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{p.factura_externa_folio || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => generarPdfProforma(p)} title="Descargar PDF">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {canEdit && p.estado === 'Pendiente' && (
                          <Button size="icon" variant="ghost" onClick={() => handleCancelar(p)} title="Cancelar">
                            <XCircle className="h-3.5 w-3.5 text-amber-600" />
                          </Button>
                        )}
                        {canEdit && p.estado === 'Cancelada' && (
                          <Button size="icon" variant="ghost" onClick={() => handleEliminar(p)} title="Eliminar">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6 text-center text-muted-foreground text-sm">No hay proformas generadas para este embarque</div>
          )}
        </CardContent>
      </Card>

      {/* FACTURAS */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Facturas del Embarque</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {facturas.length > 0 ? (
            <Table>
              <TableHeader><TableRow><TableHead># Factura</TableHead><TableHead>Monto</TableHead><TableHead>Moneda</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
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
        open={dialogProforma}
        onOpenChange={setDialogProforma}
        embarqueId={embarqueId}
        expediente={expediente}
        clienteId={clienteId}
        clienteNombre={clienteNombre}
        conceptosVenta={conceptosVenta}
      />
    </div>
  );
}
