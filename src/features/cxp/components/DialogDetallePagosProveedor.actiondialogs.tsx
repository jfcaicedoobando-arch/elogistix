/**
 * Diálogos de acción destructiva/secundaria del detalle de factura de proveedor.
 * Extraído para mantener el shell principal <200 líneas (Power of 10).
 */
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import type { useEliminarPagoProveedor } from "@/features/cxp/hooks";
import type { useCerrarFacturaProveedorSinPago } from "@/features/cxp/hooks/useCerrarFacturaSinPago";
import type { useCancelarFacturaProveedor } from "@/features/cxp/hooks/useCancelarFacturaProveedor";
import type { FacturaCxP } from "@/features/cxp/services";
import { CerrarFacturaSinPagoDialog } from "./CerrarFacturaSinPagoDialog";
import { CancelarFacturaProveedorDialog } from "./CancelarFacturaProveedorDialog";

export function ActionDialogs({
  f,
  pagoAEliminar, setPagoAEliminar, eliminar,
  aCerrarSinPago, setACerrarSinPago, cerrarSinPago,
  openCancel, setOpenCancel, cancelar,
}: {
  f: FacturaCxP | null;
  pagoAEliminar: string | null;
  setPagoAEliminar: (v: string | null) => void;
  eliminar: ReturnType<typeof useEliminarPagoProveedor>;
  aCerrarSinPago: FacturaCxP | null;
  setACerrarSinPago: (v: FacturaCxP | null) => void;
  cerrarSinPago: ReturnType<typeof useCerrarFacturaProveedorSinPago>;
  openCancel: boolean;
  setOpenCancel: (v: boolean) => void;
  cancelar: ReturnType<typeof useCancelarFacturaProveedor>;
}) {
  return (
    <>
      <DoubleConfirmDeleteDialog
        open={!!pagoAEliminar}
        onOpenChange={(o) => { if (!o) setPagoAEliminar(null); }}
        entityName="el pago"
        description="El pago será eliminado y el saldo de la factura se recalculará."
        finalDescription="Esta acción no se puede deshacer fácilmente."
        isPending={eliminar.isPending}
        onConfirm={async () => {
          if (!pagoAEliminar) return;
          await eliminar.mutateAsync(pagoAEliminar);
          setPagoAEliminar(null);
        }}
      />

      <CerrarFacturaSinPagoDialog
        factura={aCerrarSinPago}
        open={!!aCerrarSinPago}
        onOpenChange={(o) => { if (!o) setACerrarSinPago(null); }}
        isPending={cerrarSinPago.isPending}
        onConfirm={async (params) => {
          if (!aCerrarSinPago) return;
          await cerrarSinPago.mutateAsync({ ...params, facturaId: aCerrarSinPago.id });
          setACerrarSinPago(null);
        }}
      />

      {f && (
        <CancelarFacturaProveedorDialog
          factura={f}
          open={openCancel}
          onOpenChange={setOpenCancel}
          isPending={cancelar.isPending}
          onConfirm={async (motivo) => {
            await cancelar.mutateAsync({ facturaId: f.id, motivo });
            setOpenCancel(false);
          }}
        />
      )}
    </>
  );
}
