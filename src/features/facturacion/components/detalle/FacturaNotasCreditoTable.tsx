/**
 * Tabla de notas de crédito ligadas a una factura. Extraída de
 * FacturaNotasCreditoSeccion para mantener el archivo ≤ 200 líneas.
 */
import { Mail, XCircle, Stamp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { FacturaDownloadButton } from "@/features/facturacion/components/FacturaDownloadButton";
import type { EstadoNotaCredito } from "@/features/facturacion/services/notasCredito";

const ESTADO_COLOR: Record<EstadoNotaCredito, string> = {
  Borrador: "bg-muted text-muted-foreground",
  Aprobada: "bg-warning/10 text-warning border-warning/20",
  Timbrada: "bg-info/10 text-info border-info/20",
  Aplicada: "bg-success/10 text-success border-success/20",
  Cancelada: "bg-destructive/10 text-destructive border-destructive/20",
};

export interface NotaCreditoRow {
  id: string;
  folio: string;
  fecha_emision: string;
  motivo: string;
  estado: EstadoNotaCredito;
  monto: number | string;
  moneda: string;
  pdf_url: string | null;
  xml_url: string | null;
}

interface Props {
  notas: NotaCreditoRow[];
  canEdit: boolean;
  uuidFacturaOriginal: string | null;
  timbrando: boolean;
  onTimbrar: (id: string) => void;
  onEmail: (id: string) => void;
  onCancelar: (id: string) => void;
}

export function FacturaNotasCreditoTable(props: Props) {
  const { notas, canEdit, uuidFacturaOriginal, timbrando, onTimbrar, onEmail, onCancelar } = props;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b">
          <tr>
            <th className="text-left py-2 px-2">Folio</th>
            <th className="text-left py-2 px-2">Fecha</th>
            <th className="text-left py-2 px-2">Motivo</th>
            <th className="text-left py-2 px-2">Estado</th>
            <th className="text-right py-2 px-2">Monto</th>
            <th className="text-right py-2 px-2 w-44">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {notas.map((n) => {
            const timbrada = n.estado === "Timbrada" || n.estado === "Aplicada";
            const cancelable = n.estado === "Timbrada";
            const puedeTimbrar = n.estado === "Borrador" && !!uuidFacturaOriginal;
            return (
              <tr key={n.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="py-2 px-2 font-mono text-xs">{n.folio}</td>
                <td className="py-2 px-2 text-xs">{formatDate(n.fecha_emision)}</td>
                <td className="py-2 px-2 text-xs">{n.motivo}</td>
                <td className="py-2 px-2">
                  <Badge variant="outline" className={ESTADO_COLOR[n.estado]}>{n.estado}</Badge>
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {formatCurrency(Number(n.monto), n.moneda)}
                </td>
                <td className="py-2 px-2">
                  <div className="flex justify-end items-center gap-1">
                    {timbrada && (
                      <>
                        <FacturaDownloadButton stored={n.pdf_url} kind="pdf" notaCreditoId={n.id} />
                        <FacturaDownloadButton stored={n.xml_url} kind="xml" notaCreditoId={n.id} />
                        <Button
                          variant="outline" size="icon" className="h-7 w-7"
                          title="Reenviar por email" aria-label="Reenviar por email"
                          onClick={() => onEmail(n.id)}
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {canEdit && puedeTimbrar && (
                      <Button
                        variant="outline" size="sm" className="h-7"
                        onClick={() => onTimbrar(n.id)}
                        disabled={timbrando}
                      >
                        <Stamp className="h-3.5 w-3.5 mr-1" /> Timbrar
                      </Button>
                    )}
                    {canEdit && cancelable && (
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Cancelar NC" aria-label="Cancelar NC"
                        onClick={() => onCancelar(n.id)}
                      >
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
