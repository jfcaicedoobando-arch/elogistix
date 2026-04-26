import { Download, FileCode2, FileText, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { ProformaConFactura } from "@/services/proforma";

interface Props {
  proformas: ProformaConFactura[];
  canEdit: boolean;
  isDeleting: boolean;
  onDescargar: (proformaId: string) => void;
  onEliminar: (id: string, numero: string) => void;
}

export function HistorialProformas({ proformas, canEdit, isDeleting, onDescargar, onEliminar }: Props) {
  return (
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
                const facturada = (p.estado_proforma ?? "pendiente") === "facturada";
                const rev = p.estado_revision ?? "aprobada";
                let badgeRevision;
                if (rev === "pendiente") {
                  badgeRevision = <Badge variant="warning" className="w-fit">Pendiente de revisión</Badge>;
                } else if (rev === "consolidada") {
                  const consolidadaNumero = proformas.find(x => x.id === p.consolidada_en)?.numero;
                  badgeRevision = (
                    <Badge variant="info" className="w-fit">
                      Consolidada{consolidadaNumero ? ` en ${consolidadaNumero}` : ""}
                    </Badge>
                  );
                } else {
                  badgeRevision = <Badge variant="success" className="w-fit">Aprobada</Badge>;
                }

                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.numero}</TableCell>
                    <TableCell>{formatDate(p.fecha_emision)}</TableCell>
                    <TableCell className="text-sm">{p.operador || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right text-sm">
                      {p.dias_credito == null ? "—" : Number(p.dias_credito) === 0 ? "Contado" : `${p.dias_credito} días`}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(p.total_usd) > 0 ? formatCurrency(Number(p.total_usd), "USD") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(p.total_mxn) > 0 ? formatCurrency(Number(p.total_mxn), "MXN") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {badgeRevision}
                        {facturada ? (
                          <Badge variant="success" className="w-fit">Facturada</Badge>
                        ) : (
                          <Badge variant="warning" className="w-fit">Pago pendiente</Badge>
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
                        <Button variant="outline" size="sm" onClick={() => onDescargar(p.id)}>
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
                            onClick={() => onEliminar(p.id, p.numero)}
                            disabled={isDeleting}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar</>}
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
  );
}
