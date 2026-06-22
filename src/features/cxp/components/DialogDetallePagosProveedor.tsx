/**
 * Detalle de pagos de una factura de proveedor.
 * Diseño "Densa + tooltips": header con folio en mono, 4 KPIs semánticos,
 * tabla con tooltips, eliminación de pago con doble confirmación typable.
 *
 * Toolbar y tabla extraídos a `DialogDetallePagosProveedor.sections.tsx`
 * para mantener este archivo ≤ 200 líneas y complejidad ≤ 16.
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
import { formatCurrency } from "@/lib/formatters";
import type { FacturaCxP } from "@/features/cxp/services";
import { Kpi } from "./DialogDetallePagosProveedor.parts";
import { FacturaToolbar, PagosTable } from "./DialogDetallePagosProveedor.sections";
import { BotonesAprobacionFactura } from "./BotonesAprobacionFactura";
import { HistorialFacturaSection } from "./HistorialFacturaSection";
import { InfoFacturaSection } from "./InfoFacturaSection";
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

  const aprobada = f?.estado_aprobacion === "aprobada";
  const pagable = !!f && canEdit && f.saldo > 0 && f.estado !== "Borrador";
  const puedeEliminar = !!f && canEdit && f.pagado <= 0;

  return (
    <TooltipProvider delayDuration={150}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(dialogSize["3xl"], "max-h-[90vh] flex flex-col gap-0 p-0")}>
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>Detalle de factura de proveedor</DialogTitle>
            <DialogDescription className="font-mono uppercase tracking-wider text-xs">
              {f ? `${f.folio_interno} · Folio prov. ${f.folio_proveedor} — ${f.proveedor_nombre}` : ""}
            </DialogDescription>
          </DialogHeader>

          {f && (
            <FacturaToolbar
              factura={f}
              canEdit={canEdit}
              aprobada={aprobada}
              pagable={pagable}
              puedeEliminar={puedeEliminar}
              onPagar={onPagar}
              onEditar={onEditar}
              onEliminar={onEliminar}
            />
          )}

          {f && (
            <>
              <div className="px-6 pt-4 pb-3 border-b">
                <BotonesAprobacionFactura
                  facturaId={f.id}
                  estado={f.estado_aprobacion}
                  motivoRechazo={f.motivo_rechazo}
                  puedeAprobar={puedeAprobar}
                />
              </div>
              <div className="px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-3 border-b">
                <Kpi label="Total Factura" value={formatCurrency(f.total, f.moneda)} />
                <Kpi label="Total Pagado" value={formatCurrency(f.pagado, f.moneda)} tone="success" />
                <Kpi
                  label="Saldo Pendiente"
                  value={formatCurrency(f.saldo, f.moneda)}
                  tone={f.saldo > 0 ? "warn" : "default"}
                />
                <Kpi label="# Pagos" value={String(pagos.length)} />
              </div>
              <InfoFacturaSection factura={f} />
              <HistorialFacturaSection facturaId={f.id} />
            </>
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
        onOpenChange={(o) => !o && setPagoAEliminar(null)}
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
    </TooltipProvider>
  );
}
