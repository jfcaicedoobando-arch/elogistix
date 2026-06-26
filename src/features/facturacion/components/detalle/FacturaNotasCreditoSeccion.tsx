/**
 * FacturaNotasCreditoSeccion — lista las NCs ligadas a una factura y
 * permite crear, timbrar, descargar, reenviar y cancelar cada una.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileMinus, Mail, Plus, XCircle, Stamp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { listarNotasCreditoPorFactura, type EstadoNotaCredito, type ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";
import { facturas as facturasKeys } from "@/features/facturacion/queryKeys";
import { DialogCrearNotaCredito } from "@/features/facturacion/components/DialogCrearNotaCredito";
import { DialogEnviarCfdi } from "@/features/facturacion/components/DialogEnviarCfdi";
import { DialogCancelarNotaCredito } from "@/features/facturacion/components/DialogCancelarNotaCredito";
import { FacturaDownloadButton } from "@/features/facturacion/components/FacturaDownloadButton";
import { useTimbrarNotaCredito, useCancelarNotaCredito } from "@/features/facturacion/hooks/useNotaCreditoFacturapi";
import type { Tables } from "@/integrations/supabase/types";

type Moneda = Tables<"facturas">["moneda"];

const ESTADO_COLOR: Record<EstadoNotaCredito, string> = {
  Borrador: "bg-muted text-muted-foreground",
  Aprobada: "bg-warning/10 text-warning border-warning/20",
  Timbrada: "bg-info/10 text-info border-info/20",
  Aplicada: "bg-success/10 text-success border-success/20",
  Cancelada: "bg-destructive/10 text-destructive border-destructive/20",
};

interface ConceptoSnapshot {
  descripcion?: string;
  concepto?: string;
  cantidad?: number;
  precio_unitario?: number;
  precio?: number;
  importe?: number;
  total?: number;
}

function parseConceptosSugeridos(snapshot: unknown): ConceptoNotaCredito[] {
  if (typeof snapshot !== "object" || snapshot === null) return [];
  const list = (snapshot as { conceptos?: unknown }).conceptos;
  if (!Array.isArray(list)) return [];
  return (list as ConceptoSnapshot[]).map((c) => ({
    descripcion: c.descripcion ?? c.concepto ?? "",
    cantidad: Number(c.cantidad ?? 1),
    precio_unitario: Number(c.precio_unitario ?? c.precio ?? c.importe ?? 0),
    clave_sat: "84111506",
    clave_unidad: "E48",
    unidad: "Unidad de servicio",
    tasa_iva: 0.16,
  })).filter((c) => c.descripcion);
}

interface Props {
  facturaId: string;
  facturaNumero: string;
  monedaFactura: Moneda;
  tipoCambioFactura: number;
  saldoFactura: number;
  uuidFacturaOriginal: string | null;
  snapshotEmision: unknown;
  canEdit: boolean;
}

export function FacturaNotasCreditoSeccion(props: Props) {
  const { facturaId, facturaNumero, monedaFactura, tipoCambioFactura, saldoFactura, uuidFacturaOriginal, snapshotEmision, canEdit } = props;
  const [openCrear, setOpenCrear] = useState(false);
  const [emailNcId, setEmailNcId] = useState<string | null>(null);
  const [cancelarNcId, setCancelarNcId] = useState<string | null>(null);

  const timbrar = useTimbrarNotaCredito(facturaId);
  const cancelar = useCancelarNotaCredito(facturaId);

  const { data: notas = [], isLoading } = useQuery({
    queryKey: facturasKeys.notasCredito(facturaId),
    queryFn: () => listarNotasCreditoPorFactura(facturaId),
  });

  const conceptosSugeridos = useMemo(
    () => parseConceptosSugeridos(snapshotEmision),
    [snapshotEmision],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileMinus className="h-4 w-4" /> Notas de crédito
          <span className="text-xs text-muted-foreground font-normal">({notas.length})</span>
        </CardTitle>
        {canEdit && (
          <Button size="sm" onClick={() => setOpenCrear(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nueva
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : notas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Esta factura no tiene notas de crédito.</p>
        ) : (
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
                                onClick={() => setEmailNcId(n.id)}
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {canEdit && puedeTimbrar && (
                            <Button
                              variant="outline" size="sm" className="h-7"
                              onClick={() => timbrar.mutate(n.id)}
                              disabled={timbrar.isPending}
                            >
                              <Stamp className="h-3.5 w-3.5 mr-1" /> Timbrar
                            </Button>
                          )}
                          {canEdit && cancelable && (
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              title="Cancelar NC" aria-label="Cancelar NC"
                              onClick={() => setCancelarNcId(n.id)}
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
        )}
      </CardContent>

      <DialogCrearNotaCredito
        open={openCrear}
        onOpenChange={setOpenCrear}
        facturaId={facturaId}
        facturaNumero={facturaNumero}
        monedaFactura={monedaFactura}
        tipoCambioFactura={tipoCambioFactura}
        saldoFactura={saldoFactura}
        uuidFacturaOriginal={uuidFacturaOriginal}
        conceptosSugeridos={conceptosSugeridos}
      />

      <DialogEnviarCfdi
        open={!!emailNcId}
        onOpenChange={(o) => !o && setEmailNcId(null)}
        notaCreditoId={emailNcId ?? undefined}
        titulo="Reenviar nota de crédito"
      />

      <DialogCancelarNotaCredito
        open={!!cancelarNcId}
        onOpenChange={(o) => !o && setCancelarNcId(null)}
        loading={cancelar.isPending}
        onConfirm={(motivo, sustituyeUuid) => {
          if (!cancelarNcId) return;
          cancelar.mutate(
            { notaCreditoId: cancelarNcId, motivo, sustituyeUuid },
            { onSuccess: () => setCancelarNcId(null) },
          );
        }}
      />

    </Card>
  );
}
