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
import { usePagosProveedor, useEliminarPagoProveedor } from "@/features/cxp/hooks";
import { useCerrarFacturaProveedorSinPago } from "@/features/cxp/hooks/useCerrarFacturaSinPago";
import { useFacturaProveedor } from "@/features/cxp/hooks/useFacturaProveedor";
import { useCancelarFacturaProveedor } from "@/features/cxp/hooks/useCancelarFacturaProveedor";
import type { FacturaCxP } from "@/features/cxp/services";
import { FacturaResumen, PagosTable } from "./DialogDetallePagosProveedor.sections";
import { StatusActionBar } from "./DialogDetallePagosProveedor.actionbar";
import { computeFacturaFlags } from "./DialogDetallePagosProveedor.flags";
import { ActionDialogs } from "./DialogDetallePagosProveedor.actiondialogs";
import { NotasCreditoSection } from "./NotasCreditoSection";
import { InfoFacturaSection } from "./InfoFacturaSection";
import { HistorialFacturaSection } from "./HistorialFacturaSection";
import { ConceptosFacturaSection } from "./ConceptosFacturaSection";
import { AnticiposAplicadosSection } from "@/features/anticipos-proveedor/components/AnticiposAplicadosSection";
import { usePermissions } from "@/hooks/shared";
import { formatDate } from "@/lib/formatters/dates";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { getErrorMessage } from "@/lib/errors";

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
  const facturaQ = useFacturaProveedor(factura?.id, factura ?? undefined);
  const f = facturaQ.data ?? factura;
  const pagosQ = usePagosProveedor(f?.id);
  const pagos = pagosQ.data ?? [];
  const isLoading = pagosQ.isLoading;
  // Q-09 — el detalle de CxP no exponía el error de sus queries: si fallaba,
  // el modal se quedaba en blanco sin manera de reintentar.
  const errorCarga = facturaQ.error ?? pagosQ.error;
  const recargar = () => { void facturaQ.refetch(); void pagosQ.refetch(); };
  const eliminar = useEliminarPagoProveedor(f?.id ?? "");
  const cerrarSinPago = useCerrarFacturaProveedorSinPago();
  const cancelar = useCancelarFacturaProveedor();
  const [pagoAEliminar, setPagoAEliminar] = useState<string | null>(null);
  const [aCerrarSinPago, setACerrarSinPago] = useState<FacturaCxP | null>(null);
  const [openCancel, setOpenCancel] = useState(false);
  const { canAprobarFacturaProveedor } = usePermissions();
  const puedeAprobar = canAprobarFacturaProveedor;
  const flags = computeFacturaFlags(f, canEdit);

  return (
    <TooltipProvider delayDuration={150}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(dialogSize["3xl"], "max-h-[90vh] flex flex-col gap-0 p-0")}>
          <HeaderSection f={f} />

          {f && (
            <StatusActionBar
              factura={f} canEdit={canEdit} puedeAprobar={puedeAprobar} flags={flags}
              onPagar={onPagar} onEditar={onEditar} onEliminar={onEliminar}
              onCerrarSinPago={setACerrarSinPago}
              onCancelar={() => setOpenCancel(true)}
            />
          )}

          {f && <FacturaResumen f={f} pagosCount={pagos.length} />}

          {errorCarga ? (
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <ErrorStateInline
                title="No pudimos cargar el detalle de la factura"
                message={getErrorMessage(errorCarga)}
                onRetry={recargar}
                retrying={facturaQ.isFetching || pagosQ.isFetching}
              />
            </div>
          ) : (
            <BodySections
              f={f} pagos={pagos} isLoading={isLoading} canEdit={canEdit}
              onEliminarPago={setPagoAEliminar}
            />
          )}

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



function HeaderSection({ f }: { f: FacturaCxP | null }) {
  return (
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
          {f.fecha_emision && (
            <>
              {" · "}
              <span>Expedida {formatDate(f.fecha_emision)}</span>
            </>
          )}
        </p>
      )}
    </DialogHeader>
  );
}

function BodySections({
  f, pagos, isLoading, canEdit, onEliminarPago,
}: {
  f: FacturaCxP | null;
  pagos: Parameters<typeof PagosTable>[0]["pagos"];
  isLoading: boolean;
  canEdit: boolean;
  onEliminarPago: (id: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
      {f && <InfoFacturaSection factura={f} canEdit={canEdit} />}
      {f && <ConceptosFacturaSection facturaId={f.id} moneda={f.moneda} />}
      {f && <AnticiposAplicadosSection facturaId={f.id} />}
      {f && <HistorialFacturaSection facturaId={f.id} />}
      <PagosTable pagos={pagos} isLoading={isLoading} canEdit={canEdit} onEliminarPago={onEliminarPago} />
      {f && (
        <NotasCreditoSection
          facturaId={f.id}
          monedaFactura={f.moneda}
          saldoFactura={f.saldo}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
