/**
 * Sub-componentes presentacionales del detalle de factura CxP.
 * v13.349.0: los KPIs viven ahora en `DocumentoKpiStrip`; este archivo
 * conserva la tabla de pagos.
 */
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Wallet } from "lucide-react";
import { HeaderWithTooltip } from "./DialogDetallePagosProveedor.parts";
import { PagoFila, type PagoRow } from "./DialogDetallePagosProveedor.fila";

import { Table, TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
interface PagosTableProps {
  pagos: PagoRow[];
  isLoading: boolean;
  canEdit: boolean;
  onEliminarPago: (id: string) => void;
  onEditarPago?: (pago: PagoRow) => void;
}

/** Tabla de pagos aplicados a la factura de proveedor. */
export function PagosTable({ pagos, isLoading, canEdit, onEliminarPago, onEditarPago }: PagosTableProps) {
  if (isLoading) return <ListSkeleton rows={3} />;
  if (pagos.length === 0) {
    return (
      <EmptyStateInline
        icon={Wallet}
        message="No hay pagos registrados para esta factura."
      />
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table className="w-full text-body">
        <TableHeader className="bg-muted/40 text-label uppercase tracking-wider text-muted-foreground">
          <TableRow>
            <DetailTableHead>Fecha</DetailTableHead>
            <DetailTableHead>Método</DetailTableHead>
            <DetailTableHead className="text-right">Monto</DetailTableHead>
            <DetailTableHead className="text-right">
              <HeaderWithTooltip label="TC Pago" hint="Tipo de cambio USD→MXN registrado al momento de aplicar el pago." />
            </DetailTableHead>
            <DetailTableHead className="text-right">
              <HeaderWithTooltip label="Dif. Cambio" hint="Diferencia cambiaria en MXN (ganancia o pérdida) entre la tasa de la factura y la tasa del pago." />
            </DetailTableHead>
            <DetailTableHead>Banco</DetailTableHead>
            <DetailTableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border">
          {pagos.map((p) => (
            <PagoFila key={p.id} pago={p} canEdit={canEdit} onEliminar={onEliminarPago} onEditar={onEditarPago} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
