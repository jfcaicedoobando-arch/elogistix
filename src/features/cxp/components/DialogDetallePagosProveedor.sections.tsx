/**
 * Sub-componentes presentacionales extraídos de DialogDetallePagosProveedor
 * para mantener su complejidad ciclomática ≤ 16 y tamaño ≤ 200 líneas.
 */
import { Banknote, Pencil, Trash2, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { formatCurrency } from "@/lib/formatters";
import { Kpi, HeaderWithTooltip } from "./DialogDetallePagosProveedor.parts";
import { BotonesAprobacionFactura } from "./BotonesAprobacionFactura";
import { HistorialFacturaSection } from "./HistorialFacturaSection";
import { InfoFacturaSection } from "./InfoFacturaSection";
import { PagoFila, type PagoRow } from "./DialogDetallePagosProveedor.fila";
import type { FacturaCxP } from "@/features/cxp/services";
import type { FacturaFlags } from "./DialogDetallePagosProveedor.flags";


interface ToolbarProps {
  factura: FacturaCxP;
  canEdit: boolean;
  flags: FacturaFlags;
  onPagar?: (f: FacturaCxP) => void;
  onEditar?: (f: FacturaCxP) => void;
  onEliminar?: (f: FacturaCxP) => void;
  onCerrarSinPago?: (f: FacturaCxP) => void;
}

export function FacturaToolbar({ factura: f, canEdit, flags, onPagar, onEditar, onEliminar, onCerrarSinPago }: ToolbarProps) {
  const algunaAccion = onPagar || onEditar || onEliminar || onCerrarSinPago;
  if (!canEdit || !algunaAccion) return null;
  return (
    <div className="px-6 py-3 border-b bg-muted/20 flex flex-wrap items-center gap-2">
      {onPagar && flags.pagable && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" onClick={() => onPagar(f)} disabled={!flags.aprobada}>
                <Banknote className="h-3.5 w-3.5 mr-1" /> Registrar pago
              </Button>
            </span>
          </TooltipTrigger>
          {!flags.aprobada && (
            <TooltipContent>Requiere aprobación antes de pagar</TooltipContent>
          )}
        </Tooltip>
      )}
      {onEditar && (
        <Button variant="outline" size="sm" onClick={() => onEditar(f)}>
          <Pencil className="h-3.5 w-3.5 mr-1" /> Editar factura
        </Button>
      )}
      {onCerrarSinPago && flags.puedeCerrarSinPago && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onCerrarSinPago(f)}
                className="text-warning border-warning/40 hover:bg-warning/10 hover:text-warning"
              >
                <FileCheck2 className="h-3.5 w-3.5 mr-1" /> Cerrar sin pago
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Saldar la factura mediante ajuste (compensación, quita, etc.) sin registrar un pago real.
          </TooltipContent>
        </Tooltip>
      )}
      {onEliminar && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEliminar(f)}
                disabled={!flags.puedeEliminar}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar factura
              </Button>
            </span>
          </TooltipTrigger>
          {!flags.puedeEliminar && (
            <TooltipContent>No se puede eliminar: tiene pagos registrados</TooltipContent>
          )}
        </Tooltip>
      )}
    </div>
  );
}

/** Bloque central: aprobación + KPIs + info + historial. Asume `f` no-null. */
export function FacturaResumen({
  f, pagosCount, puedeAprobar,
}: { f: FacturaCxP; pagosCount: number; puedeAprobar: boolean }) {
  return (
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
        <Kpi label="# Pagos" value={String(pagosCount)} />
      </div>
      <InfoFacturaSection factura={f} />
      <HistorialFacturaSection facturaId={f.id} />
    </>
  );
}

interface PagosTableProps {
  pagos: PagoRow[];
  isLoading: boolean;
  canEdit: boolean;
  onEliminarPago: (id: string) => void;
}

export function PagosTable({ pagos, isLoading, canEdit, onEliminarPago }: PagosTableProps) {
  if (isLoading) {
    return <ListSkeleton rows={3} />;
  }
  if (pagos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        No hay pagos registrados para esta factura.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-label uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-3 font-bold">Fecha</th>
            <th className="text-left px-4 py-3 font-bold">Método</th>
            <th className="text-right px-4 py-3 font-bold">Monto</th>
            <th className="text-right px-4 py-3 font-bold">
              <HeaderWithTooltip
                label="TC Pago"
                hint="Tipo de cambio USD→MXN registrado al momento de aplicar el pago."
              />
            </th>
            <th className="text-right px-4 py-3 font-bold">
              <HeaderWithTooltip
                label="Dif. Cambio"
                hint="Diferencia cambiaria en MXN (ganancia o pérdida) entre la tasa de la factura y la tasa del pago."
              />
            </th>
            <th className="text-left px-4 py-3 font-bold">Banco</th>
            <th className="w-12" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {pagos.map((p) => (
            <PagoFila key={p.id} pago={p} canEdit={canEdit} onEliminar={onEliminarPago} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
