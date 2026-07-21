/**
 * Detalle de factura de proveedor (modal).
 * v13.303.94 — Rediseño "Card grid estructurada": header inline con folio-chip,
 * StatusActionBar contextual, KPIs con énfasis, secciones agrupadas.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { Button } from "@/components/ui/button";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { usePagosProveedor, useEliminarPagoProveedor } from "@/features/cxp/hooks";
import { useCerrarFacturaProveedorSinPago } from "@/features/cxp/hooks/useCerrarFacturaSinPago";
import { useFacturaProveedor } from "@/features/cxp/hooks/useFacturaProveedor";
import { useCancelarFacturaProveedor } from "@/features/cxp/hooks/useCancelarFacturaProveedor";
import type { FacturaCxP } from "@/features/cxp/services";
import { FacturaResumen, PagosTable } from "./DialogDetallePagosProveedor.sections";
import { StatusActionBar } from "./DialogDetallePagosProveedor.actionbar";
import { computeFacturaFlags } from "./DialogDetallePagosProveedor.flags";
import { NotasCreditoSection } from "./NotasCreditoSection";
import { CerrarFacturaSinPagoDialog } from "./CerrarFacturaSinPagoDialog";
import { CancelarFacturaProveedorDialog } from "./CancelarFacturaProveedorDialog";
import { InfoFacturaSection } from "./InfoFacturaSection";
import { HistorialFacturaSection } from "./HistorialFacturaSection";
import { usePermissions } from "@/hooks/shared";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factura: FacturaCxP | null;
  canEdit: boolean;
  onPagar?: (f: FacturaCxP) => void;
  onEditar?: (f: FacturaCxP) => void;
  onEliminar?: (f: FacturaCxP) => void;
}

export function DialogDetallePagosProveedor({
  open, onOpenChange, factura, canEdit, onPagar, onEditar, onEliminar,
}: Props) {
  const { data: facturaFresh } = useFacturaProveedor(factura?.id, factura ?? undefined);
  const f = facturaFresh ?? factura;
  const { data: pagos = [], isLoading } = usePagosProveedor(f?.id);
  const eliminar = useEliminarPagoProveedor(f?.id ?? "");
  const cerrarSinPago = useCerrarFacturaProveedorSinPago();
  const cancelar = useCancelarFacturaProveedor();
  const [pagoAEliminar, setPagoAEliminar] = useState<string | null>(null);
  const [aCerrarSinPago, setACerrarSinPago] = useState<FacturaCxP | null>(null);
  const [openCancel, setOpenCancel] = useState(false);
  const { canEditFinance, isAdmin } = usePermissions();
  const puedeAprobar = canEditFinance || isAdmin;
  const flags = computeFacturaFlags(f, canEdit);

  return (
    <TooltipProvider delayDuration={150}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(dialogSize["3xl"], "max-h-[90vh] flex flex-col gap-0 p-0")}>
          <DialogHeader className="px-6 pt-5 pb-4 border-b bg-muted/30 space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <DialogTitle className="text-lg font-bold text-primary">
                Detalle de factura de proveedor
              </DialogTitle>
              {f?.folio_interno && (
                <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs font-mono font-semibold uppercase tracking-wider border">
                  {f.folio_interno}
                </span>
              )}
            </div>
            {f && (
              <p className="text-xs text-muted-foreground">
                Folio prov. <span className="font-mono">{f.folio_proveedor}</span>
                {" — "}{f.proveedor_nombre}
              </p>
            )}
          </DialogHeader>

          {f && (
            <StatusActionBar
              factura={f}
              canEdit={canEdit}
              puedeAprobar={puedeAprobar}
              flags={flags}
              onPagar={onPagar}
              onEditar={onEditar}
              onEliminar={onEliminar}
              onCerrarSinPago={setACerrarSinPago}
              onCancelar={() => setOpenCancel(true)}
            />
          )}

          {f && <FacturaResumen f={f} pagosCount={pagos.length} />}

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {f && <InfoFacturaSection factura={f} />}
            {f && <HistorialFacturaSection facturaId={f.id} />}
            <PagosTable
              pagos={pagos}
              isLoading={isLoading}
              canEdit={canEdit}
              onEliminarPago={setPagoAEliminar}
            />
            {f && (
              <NotasCreditoSection
                facturaId={f.id}
                monedaFactura={f.moneda}
                saldoFactura={f.saldo}
                canEdit={canEdit}
              />
            )}
          </div>

          <div className="px-6 py-3 border-t flex justify-end bg-background">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ActionDialogs
        f={f}
        pagoAEliminar={pagoAEliminar} setPagoAEliminar={setPagoAEliminar} eliminar={eliminar}
        aCerrarSinPago={aCerrarSinPago} setACerrarSinPago={setACerrarSinPago} cerrarSinPago={cerrarSinPago}
        openCancel={openCancel} setOpenCancel={setOpenCancel} cancelar={cancelar}
      />
    </TooltipProvider>
  );
}

function ActionDialogs({
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
