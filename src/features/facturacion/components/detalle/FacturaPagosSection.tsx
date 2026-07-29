/**
 * FacturaPagosSection — historial de pagos con acciones admin
 * (registrar pago / eliminar pago). Reusa `usePagosFactura` y los hooks
 * de mutación ya existentes. El cálculo de saldo replica al del diálogo
 * de registrar pago: `total − Σ monto_aplicado_factura`.
 *
 * v13.232.0 · Confirmación de eliminar pago migrada a `ConfirmActionDialog` (Lote 7d.2).
 */
import { useState } from "react";
import { Trash2, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { usePagosFactura, useEliminarPagoFactura } from "@/features/facturacion/hooks";
import { useNotasCreditoAplicadas } from "@/features/facturacion/hooks/useSaldoFactura";
import { calcularSaldoFactura } from "@/lib/financial/saldoFactura";
import { useRegistrarActividad } from "@/hooks/shared";
import { DialogPreviewCfdiPdf } from "@/features/facturacion/components/DialogPreviewCfdiPdf";
import { FORMAS_PAGO_SAT, labelDeCatalogo } from "@/constants/catalogosSAT";
import { PagoRepCell } from "./PagoRepCell";

interface Props {
  facturaId: string;
  facturaNumero: string;
  totalFactura: number;
  moneda: string;
  canEdit: boolean;
  /** @deprecated Ahora el botón vive en `FacturaDetalleActionsBar`. */
  onRegistrarPago?: () => void;
}

export function FacturaPagosSection({
  facturaId, facturaNumero, totalFactura, moneda, canEdit,
}: Props) {
  const { data: pagos = [], isLoading } = usePagosFactura(facturaId);
  const eliminar = useEliminarPagoFactura();
  const registrarActividad = useRegistrarActividad();
  const [pagoAEliminar, setPagoAEliminar] = useState<string | null>(null);
  const [previewRep, setPreviewRep] = useState<{ id: string; label: string } | null>(null);

  const totalPagado = pagos.reduce((s, p) => s + Number(p.monto_aplicado_factura ?? 0), 0);
  const saldo = Math.max(0, totalFactura - totalPagado);
  const liquidada = saldo < 0.01 && pagos.length > 0;

  const handleEliminar = async () => {
    if (!pagoAEliminar) return;
    try {
      await eliminar.mutateAsync({ id: pagoAEliminar, facturaId });
      registrarActividad.mutate({
        accion: "eliminar",
        modulo: "facturas",
        entidad_id: facturaId,
        entidad_nombre: `Pago eliminado factura ${facturaNumero}`,
      });
      // NOTA: `notifySuccess` de éxito lo dispara el hook `useEliminarPagoFactura`.
      // Aquí sólo cerramos el diálogo.
      setPagoAEliminar(null);
    } catch {
      // El hook `useEliminarPagoFactura` ya muestra el toast con el error real.
      // Este catch sólo evita una promesa rechazada sin manejar desde el diálogo.
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" /> Historial de pagos
            </CardTitle>
            {pagos.length > 0 && (
              <Badge variant={liquidada ? "default" : "secondary"} className="gap-1">
                {liquidada ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {liquidada ? "Liquidada" : "Saldo pendiente"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <ListSkeleton rows={3} />
          ) : pagos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aún no se han registrado pagos para esta factura.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 px-2">Fecha</th>
                    <th className="text-right py-2 px-2">Monto</th>
                    <th className="text-right py-2 px-2">Aplicado</th>
                    <th className="text-left py-2 px-2">Forma</th>
                    <th className="text-left py-2 px-2">Referencia</th>
                    <th className="text-left py-2 px-2">REP</th>
                    {canEdit && <th className="w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 px-2 whitespace-nowrap">{formatDate(p.fecha_pago)}</td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        {formatCurrency(Number(p.monto), p.moneda)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">
                        {formatCurrency(Number(p.monto_aplicado_factura), moneda)}
                      </td>
                      <td className="py-2 px-2">{labelDeCatalogo(FORMAS_PAGO_SAT, p.forma_pago)}</td>
                      <td className="py-2 px-2 max-w-[200px] truncate" title={p.referencia ?? ""}>
                        {p.referencia || "—"}
                      </td>
                      <td className="py-2 px-2">
                        <PagoRepCell
                          pagoId={p.id}
                          facturaId={facturaId}
                          estadoRep={p.estado_rep}
                          serieRep={p.serie_rep ?? null}
                          folioRep={p.folio_rep ?? null}
                          onPreview={(id, label) => setPreviewRep({ id, label })}
                        />
                      </td>
                      {canEdit && (
                        <td className="py-2 px-2">
                          {(() => {
                            const repVivo = !!p.uuid_rep && !p.rep_cancelado_en;
                            return (
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={repVivo}
                                title={
                                  repVivo
                                    ? "Cancela el REP (complemento de pago) antes de eliminar este pago"
                                    : "Eliminar pago"
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (repVivo) return;
                                  setPagoAEliminar(p.id);
                                }}
                                aria-label="Eliminar pago"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            );
                          })()}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t pt-3 grid grid-cols-2 gap-2">
            <div>
              <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">Pagado</p>
              <p className="text-base font-semibold tabular-nums">{formatCurrency(totalPagado, moneda)}</p>
            </div>
            <div className="text-right">
              <p className="text-label font-medium uppercase tracking-wide text-muted-foreground">Saldo</p>
              <p className={`text-base font-semibold tabular-nums ${liquidada ? "text-success" : "text-accent"}`}>
                {formatCurrency(saldo, moneda)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={!!pagoAEliminar}
        onOpenChange={(o) => { if (!o) setPagoAEliminar(null); }}
        title="Eliminar pago"
        variant="destructive"
        confirmLabel="Eliminar"
        isPending={eliminar.isPending}
        onConfirm={handleEliminar}
        description="¿Estás seguro? Esto recalculará el estado de la factura."
      />

      <DialogPreviewCfdiPdf
        open={!!previewRep}
        onOpenChange={(o) => !o && setPreviewRep(null)}
        pagoId={previewRep?.id}
        title={previewRep ? `Complemento de pago ${previewRep.label}` : "Complemento de pago"}
      />
    </>
  );
}
