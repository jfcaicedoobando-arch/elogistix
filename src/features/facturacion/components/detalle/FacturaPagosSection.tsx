/**
 * FacturaPagosSection — historial de pagos con acciones admin
 * (registrar pago / eliminar pago). Reusa `usePagosFactura` y los hooks
 * de mutación ya existentes. El cálculo de saldo replica al del diálogo
 * de registrar pago: `total − Σ monto_aplicado_factura`.
 *
 * v13.232.0 · Confirmación de eliminar pago migrada a `ConfirmActionDialog` (Lote 7d.2).
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { formatCurrency } from "@/lib/formatters";
import { usePagosFactura, useEliminarPagoFactura } from "@/features/facturacion/hooks";
import { useNotasCreditoAplicadas } from "@/features/facturacion/hooks/useSaldoFactura";
import { calcularSaldoFactura } from "@/lib/financial/saldoFactura";
import { useRegistrarActividad } from "@/hooks/shared";
import { DialogPreviewCfdiPdf } from "@/features/facturacion/components/DialogPreviewCfdiPdf";
import { FacturaPagosTabla } from "./FacturaPagosTabla";
import { FacturaPagosHeader } from "./FacturaPagosHeader";
import { FacturaEstadoInconsistenteAlert } from "./FacturaEstadoInconsistenteAlert";
import { esEstadoInconsistente } from "./facturaEstadoInconsistente";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Receipt } from "lucide-react";

interface Props {
  facturaId: string;
  facturaNumero: string;
  totalFactura: number;
  moneda: string;
  canEdit: boolean;
  /** Estado actual de la factura (para detectar inconsistencias contables). */
  estadoFactura?: string;
  /** @deprecated Ahora el botón vive en `FacturaDetalleActionsBar`. */
  onRegistrarPago?: () => void;
}

export function FacturaPagosSection({
  facturaId, facturaNumero, totalFactura, moneda, canEdit, estadoFactura,
}: Props) {
  const { data: pagos = [], isLoading } = usePagosFactura(facturaId);
  const { data: notasAplicadas = [] } = useNotasCreditoAplicadas(facturaId);
  const eliminar = useEliminarPagoFactura();
  const registrarActividad = useRegistrarActividad();
  const [pagoAEliminar, setPagoAEliminar] = useState<string | null>(null);
  const [previewRep, setPreviewRep] = useState<{ id: string; label: string } | null>(null);

  // A1: canon único `@/lib/financial/saldoFactura` (descuenta pagos y NC aplicadas).
  // Auditoría 2026-08-28 · Hallazgo 4: el estado entra al cálculo (facturas
  // terminales no pueden mostrar saldo por cobrar).
  const { saldo, pagado: totalPagado, liquidada: sinSaldo } = calcularSaldoFactura(
    totalFactura,
    pagos,
    notasAplicadas,
    estadoFactura,
  );
  const liquidada = sinSaldo && pagos.length > 0;

  const inconsistente = esEstadoInconsistente({
    isLoading,
    estadoFactura,
    pagosCount: pagos.length,
    notasAplicadasCount: notasAplicadas.length,
  });

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
        <FacturaPagosHeader hayPagos={pagos.length > 0} liquidada={liquidada} />
        <CardContent className="space-y-3">
          {inconsistente && <FacturaEstadoInconsistenteAlert estadoFactura={estadoFactura} />}
          {isLoading ? (
            <ListSkeleton rows={3} />
          ) : pagos.length === 0 ? (
            <EmptyStateInline
              icon={Receipt}
              message="Aún no se han registrado pagos para esta factura."
              className="py-4"
            />
          ) : (
            <FacturaPagosTabla
              pagos={pagos}
              facturaId={facturaId}
              moneda={moneda}
              canEdit={canEdit}
              onEliminar={setPagoAEliminar}
              onPreviewRep={(id, label) => setPreviewRep({ id, label })}
            />

          )}

          <div className="border-t pt-3 grid grid-cols-2 gap-2">
            <div>
              <p className="text-overline font-medium">Pagado</p>
              <p className="text-base font-semibold tabular-nums">{formatCurrency(totalPagado, moneda)}</p>
            </div>
            <div className="text-right">
              <p className="text-overline font-medium">Saldo</p>
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
