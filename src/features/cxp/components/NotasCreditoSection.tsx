/**
 * Sección de Notas de Crédito dentro del diálogo de detalle de factura de proveedor.
 * Permite listar, registrar, aplicar y cancelar NCs (cuando hay permisos).
 */
import { useState } from "react";
import { format } from "date-fns";
import { Plus, Check, X, ShieldCheck, FileText, FileDigit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { formatCurrency } from "@/lib/formatters";
import {
  useNotasCreditoFactura, useAplicarNotaCredito, useAprobarNotaCredito, useCancelarNotaCredito,
} from "@/features/cxp/hooks/useNotasCreditoProveedor";
import { DialogNotaCreditoProveedor } from "./DialogNotaCreditoProveedor";
import { NcSatBadge } from "./NcSatBadge";
import { getFacturaSignedUrl } from "@/services/storage/facturas";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Moneda = Tables<"proveedor_notas_credito">["moneda"];

interface Props {
  facturaId: string;
  monedaFactura: Moneda;
  saldoFactura: number;
  canEdit: boolean;
}

function NcEstadoBadge({ estado }: { estado: string }) {
  if (estado === "Aplicada") return <Badge className="bg-success/15 text-success border-success/30">Aplicada</Badge>;
  if (estado === "Cancelada") return <Badge variant="secondary">Cancelada</Badge>;
  if (estado === "Aprobada") return <Badge className="bg-info/15 text-info border-info/30">Aprobada</Badge>;
  return <Badge variant="outline">Borrador</Badge>;
}

async function openStoredFile(path: string | null | undefined) {
  if (!path) return;
  try {
    const url = await getFacturaSignedUrl(path);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    toast.error("No se pudo generar la liga de descarga del archivo.");
  }
}

export function NotasCreditoSection({ facturaId, monedaFactura, saldoFactura, canEdit }: Props) {
  const { data: notas = [], isLoading } = useNotasCreditoFactura(facturaId);
  const aplicar = useAplicarNotaCredito(facturaId);
  const aprobar = useAprobarNotaCredito(facturaId);
  const cancelar = useCancelarNotaCredito(facturaId);
  const [openNueva, setOpenNueva] = useState(false);

  return (
    <div className="border rounded-md">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <h3 className="text-sm font-semibold">Notas de crédito</h3>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setOpenNueva(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Registrar NC
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="p-3"><ListSkeleton rows={2} /></div>
      ) : notas.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Sin notas de crédito registradas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-label uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Folio</th>
                <th className="text-left px-3 py-2">Fecha</th>
                <th className="text-left px-3 py-2">Motivo</th>
                <th className="text-right px-3 py-2">Monto</th>
                <th className="text-center px-3 py-2">Estado</th>
                <th className="text-center px-3 py-2">SAT</th>
                <th className="text-center px-3 py-2">XML</th>
                <th className="text-center px-3 py-2">PDF</th>
                <th className="w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {notas.map((n) => (
                <tr key={n.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">{n.folio_nc}</td>
                  <td className="px-3 py-2">{format(new Date(n.fecha + "T00:00:00"), "dd/MM/yyyy")}</td>
                  <td className="px-3 py-2 text-muted-foreground">{n.motivo}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(n.monto), n.moneda)}</td>
                  <td className="px-3 py-2 text-center"><NcEstadoBadge estado={n.estado} /></td>
                  <td className="px-3 py-2 text-center">
                    <NcSatBadge
                      facturaId={facturaId}
                      ncId={n.id}
                      uuidFiscal={n.uuid_fiscal}
                      estatus={n.uuid_estatus_sat}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    {n.archivo_xml_url ? (
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => openStoredFile(n.archivo_xml_url)}
                        title="Descargar XML"
                      >
                        <FileDigit className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {n.archivo_pdf_url ? (
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => openStoredFile(n.archivo_pdf_url)}
                        title="Descargar PDF"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right space-x-1">
                    {canEdit && n.estado === "Borrador" && (
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 text-info hover:bg-info/10"
                        onClick={() => aprobar.mutate(n.id)}
                        disabled={aprobar.isPending}
                        title="Aprobar"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canEdit && n.estado === "Aprobada" && (
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 text-success hover:bg-success/10"
                        onClick={() => aplicar.mutate(n.id)}
                        disabled={aplicar.isPending}
                        title="Aplicar al saldo"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canEdit && n.estado !== "Cancelada" && (
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => cancelar.mutate(n.id)}
                        disabled={cancelar.isPending}
                        title="Cancelar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DialogNotaCreditoProveedor
        open={openNueva}
        onOpenChange={setOpenNueva}
        facturaId={facturaId}
        monedaFactura={monedaFactura}
        saldoFactura={saldoFactura}
      />
    </div>
  );
}
