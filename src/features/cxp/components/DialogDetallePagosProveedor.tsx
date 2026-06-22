/**
 * Detalle de pagos de una factura de proveedor.
 * Toolbar, resumen, tabla y fila están en `.sections.tsx` para mantener este
 * archivo ≤ 200 líneas y complejidad ≤ 16.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { Button } from "@/components/ui/button";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { usePagosProveedor, useEliminarPagoProveedor } from "@/features/cxp/hooks";
import { useFacturaProveedor } from "@/features/cxp/hooks/useFacturaProveedor";
import type { FacturaCxP } from "@/features/cxp/services";
import {
  FacturaToolbar, FacturaResumen, PagosTable,
} from "./DialogDetallePagosProveedor.sections";
import { computeFacturaFlags } from "./DialogDetallePagosProveedor.flags";
import { NotasCreditoSection } from "./NotasCreditoSection";
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

function tituloDescripcion(f: FacturaCxP | null): string {
  if (!f) return "";
  return `${f.folio_interno} · Folio prov. ${f.folio_proveedor} — ${f.proveedor_nombre}`;
}

export function DialogDetallePagosProveedor({
  open, onOpenChange, factura, canEdit, onPagar, onEditar, onEliminar,
}: Props) {
  // Observamos la factura por id para que el badge de aprobación y el saldo
  // se mantengan frescos aunque la lista filtrada haya descartado la fila.
  const { data: facturaFresh } = useFacturaProveedor(factura?.id, factura ?? undefined);
  const f = facturaFresh ?? factura;
  const { data: pagos = [], isLoading } = usePagosProveedor(f?.id);
  const eliminar = useEliminarPagoProveedor(f?.id ?? "");
  const [pagoAEliminar, setPagoAEliminar] = useState<string | null>(null);
  const { canEditFinance, isAdmin } = usePermissions();
  const puedeAprobar = canEditFinance || isAdmin;
  const flags = computeFacturaFlags(f, canEdit);

  const handleConfirmEliminar = async () => {
    if (!pagoAEliminar) return;
    await eliminar.mutateAsync(pagoAEliminar);
    setPagoAEliminar(null);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(dialogSize["3xl"], "max-h-[90vh] flex flex-col gap-0 p-0")}>
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>Detalle de factura de proveedor</DialogTitle>
            <DialogDescription className="font-mono uppercase tracking-wider text-xs">
              {tituloDescripcion(f)}
            </DialogDescription>
          </DialogHeader>

          {f && (
            <FacturaToolbar
              factura={f}
              canEdit={canEdit}
              flags={flags}
              onPagar={onPagar}
              onEditar={onEditar}
              onEliminar={onEliminar}
            />
          )}

          {f && (
            <FacturaResumen f={f} pagosCount={pagos.length} puedeAprobar={puedeAprobar} />
          )}

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
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

          <div className="px-6 py-4 border-t flex justify-end bg-background">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <DoubleConfirmDeleteDialog
        open={!!pagoAEliminar}
        onOpenChange={(o) => { if (!o) setPagoAEliminar(null); }}
        entityName="el pago"
        description="El pago será eliminado y el saldo de la factura se recalculará."
        finalDescription="Esta acción no se puede deshacer fácilmente."
        isPending={eliminar.isPending}
        onConfirm={handleConfirmEliminar}
      />
    </TooltipProvider>
  );
}
