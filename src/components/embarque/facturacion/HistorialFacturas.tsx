import { FileCode2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import type { ProformaConFactura } from "@/services/proformaServices";

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
  proformas: ProformaConFactura[];
}

export function HistorialFacturas({ facturas, proformas }: Props) {
  return (
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
  );
}
