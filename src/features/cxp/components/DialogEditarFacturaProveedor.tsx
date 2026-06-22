/**
 * Editor de factura de proveedor existente. Reusa FacturaProveedorFormFields,
 * mantiene proveedor + CFDI como read-only y delega la lógica al hook
 * useEditarFacturaProveedorForm. Muestra banners cuando la factura tiene pagos
 * o cuando los cambios fuerzan re-aprobación.
 */
import { Loader2, AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { usePresupuestoCategorias } from "@/features/presupuesto/hooks";
import { useEditarFacturaProveedorForm } from "@/features/cxp/hooks";
import { FacturaProveedorFormFields } from "./FacturaProveedorFormFields";
import type { FacturaCxP } from "@/features/cxp/services";

interface Props {
  factura: FacturaCxP | null;
  onOpenChange: (o: boolean) => void;
}

const SENSIBLES: Array<keyof ReturnType<typeof initialPick>> = [
  "folio", "emision", "moneda", "tc", "subtotal", "iva", "retenciones",
];
function initialPick(v: { folio: string; emision: string; moneda: string; tc: string; subtotal: string; iva: string; retenciones: string }) {
  return v;
}

export function DialogEditarFacturaProveedor({ factura, onOpenChange }: Props) {
  const open = !!factura;
  const cats = usePresupuestoCategorias(true);
  const ctl = useEditarFacturaProveedorForm({
    factura,
    onDone: () => onOpenChange(false),
  });

  const v = ctl.values;
  const sub = v ? Number(v.subtotal) || 0 : 0;
  const iva = v ? Number(v.iva) || 0 : 0;
  const ret = v ? Number(v.retenciones) || 0 : 0;
  const moneda = v?.moneda ?? factura?.moneda ?? "MXN";

  const tienePagos = !!factura && factura.pagado > 0;
  const estabaAprobada = factura?.estado_aprobacion === "aprobada";
  const requiereReaprobacion =
    estabaAprobada && !!v && !!factura && SENSIBLES.some((k) => {
      // Compara contra los valores actuales de la factura (proxy: comparamos
      // contra el snapshot inicial cargado del form).
      // Si cambia cualquiera de estos, dispara re-aprobación.
      return false; // placeholder, ver abajo
    });
  // Heurística simple: si hubo cambios y la factura estaba aprobada, advertir
  // que probablemente se regresará a "Por aprobar". El backend hace la decisión
  // real comparando sólo campos sensibles; aquí mostramos un aviso conservador.
  const aviso = estabaAprobada && ctl.hayCambios;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <DialogContent className={cn(dialogSize.xl, "max-h-[90vh] flex flex-col gap-0 p-0")}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle>
                Editar factura — {factura?.folio_proveedor ?? ""}
              </DialogTitle>
              <DialogDescription>
                Corrige folio, fechas o importes. El proveedor y el CFDI fiscal no se pueden cambiar.
              </DialogDescription>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total</div>
              <div className="text-2xl font-bold tabular-nums leading-tight">
                {formatCurrency(ctl.total, moneda)}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {ctl.isLoadingRow && (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cargando factura…
            </div>
          )}

          {ctl.isErrorRow && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              No se pudo cargar la factura. Cierra y vuelve a abrir el diálogo.
            </div>
          )}

          {!ctl.isLoadingRow && v && factura && (
            <>
              {/* Proveedor read-only */}
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                <div className="font-semibold text-muted-foreground uppercase tracking-wide">Proveedor (no editable)</div>
                <div className="mt-0.5 text-sm font-medium text-foreground">{factura.proveedor_nombre}</div>
              </div>

              {tienePagos && (
                <div className="flex gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    Esta factura tiene pagos por <strong>{formatCurrency(factura.pagado, factura.moneda)}</strong>.
                    El nuevo total no puede quedar por debajo de lo ya pagado.
                  </div>
                </div>
              )}

              {aviso && (
                <div className="flex gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    Si cambias folio, fecha de emisión o algún importe, la factura volverá a estado <strong>Por aprobar</strong>.
                  </div>
                </div>
              )}

              <FacturaProveedorFormFields
                values={v}
                onChange={ctl.handleChange}
                onProveedor={ctl.handleProveedor}
                categorias={cats.data ?? []}
                total={ctl.total}
                errors={ctl.errors}
              />
            </>
          )}
        </div>

        <div className="border-t bg-background">
          <div className="px-6 pt-3 pb-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs tabular-nums">
            <span className="text-muted-foreground">Subtotal: <span className="text-foreground font-medium">{formatCurrency(sub, moneda)}</span></span>
            <span className="text-muted-foreground">IVA: <span className="text-foreground font-medium">{formatCurrency(iva, moneda)}</span></span>
            <span className="text-muted-foreground">Ret: <span className="text-foreground font-medium">{formatCurrency(ret, moneda)}</span></span>
            <span className="text-muted-foreground">Total: <span className="text-foreground font-semibold">{formatCurrency(ctl.total, moneda)}</span></span>
          </div>
          <div className="px-6 py-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={ctl.isPending}>
              Cancelar
            </Button>
            <Button onClick={ctl.submit} disabled={ctl.isPending || !ctl.hayCambios || !v}>
              {ctl.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {ctl.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
