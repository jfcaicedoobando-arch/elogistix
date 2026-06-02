import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { usePagosProveedor, useEliminarPagoProveedor } from "@/hooks/cxp";
import { formatCurrency } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import type { FacturaCxP } from "@/services/cxp/proveedorFacturas";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  factura: FacturaCxP | null;
  canEdit: boolean;
}

export function DialogDetallePagosProveedor({ open, onOpenChange, factura, canEdit }: Props) {
  const { data: pagos = [], isLoading } = usePagosProveedor(factura?.id);
  const eliminar = useEliminarPagoProveedor(factura?.id ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalle de pagos</DialogTitle>
          <DialogDescription>
            {factura ? `${factura.folio_proveedor} — ${factura.proveedor_nombre}` : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        ) : pagos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No hay pagos registrados</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="text-left py-2">Fecha</th>
                <th className="text-left py-2">Método</th>
                <th className="text-left py-2">Referencia</th>
                <th className="text-right py-2">Monto</th>
                <th className="text-right py-2">TC</th>
                <th className="text-right py-2">Δ MXN</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="py-2">{format(new Date(p.fecha_pago + "T00:00:00"), "dd/MM/yyyy")}</td>
                  <td className="py-2">{p.metodo_pago}</td>
                  <td className="py-2 text-xs">{p.referencia || "—"}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCurrency(Number(p.monto), p.moneda)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-xs">
                    {p.tipo_cambio_usd ? Number(p.tipo_cambio_usd).toFixed(2) : "—"}
                  </td>
                  <td className="py-2 text-right tabular-nums text-xs">
                    {p.diferencia_cambiaria_mxn != null ? formatCurrency(Number(p.diferencia_cambiaria_mxn), "MXN") : "—"}
                  </td>
                  <td className="py-2 text-right">
                    {canEdit && (
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => {
                          if (window.confirm("¿Eliminar este pago?")) eliminar.mutate(p.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DialogContent>
    </Dialog>
  );
}
