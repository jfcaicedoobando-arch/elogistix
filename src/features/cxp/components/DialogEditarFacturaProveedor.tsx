/**
 * Editor de factura de proveedor existente. Reusa FacturaProveedorFormFields,
 * mantiene proveedor + CFDI como read-only y delega la lógica al hook
 * useEditarFacturaProveedorForm. Muestra banners cuando la factura tiene pagos
 * o cuando los cambios fuerzan re-aprobación.
 *
 * Sub-componentes extraídos a este mismo archivo (no exportados) para mantener
 * la complejidad ciclomática ≤ 16.
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

function HeaderTitulo({ factura, total, moneda }: { factura: FacturaCxP; total: number; moneda: string }) {
  const folioProv = factura.folio_proveedor;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <DialogTitle>
          Editar factura — {factura.folio_interno ?? ""}
          {folioProv ? (
            <span className="text-muted-foreground font-normal text-base"> · Folio prov. {folioProv}</span>
          ) : null}
        </DialogTitle>
        <DialogDescription>
          Corrige folio, fechas o importes. El proveedor y el CFDI fiscal no se pueden cambiar.
        </DialogDescription>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Total</div>
        <div className="text-2xl font-bold tabular-nums leading-tight">
          {formatCurrency(total, moneda)}
        </div>
      </div>
    </div>
  );
}

function TotalesFooter({
  sub, iva, ret, total, moneda,
}: { sub: number; iva: number; ret: number; total: number; moneda: string }) {
  return (
    <div className="px-6 pt-3 pb-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs tabular-nums">
      <span className="text-muted-foreground">Subtotal: <span className="text-foreground font-medium">{formatCurrency(sub, moneda)}</span></span>
      <span className="text-muted-foreground">IVA: <span className="text-foreground font-medium">{formatCurrency(iva, moneda)}</span></span>
      <span className="text-muted-foreground">Ret: <span className="text-foreground font-medium">{formatCurrency(ret, moneda)}</span></span>
      <span className="text-muted-foreground">Total: <span className="text-foreground font-semibold">{formatCurrency(total, moneda)}</span></span>
    </div>
  );
}

function BannerPagos({ factura }: { factura: FacturaCxP }) {
  if (factura.pagado <= 0) return null;
  return (
    <div className="flex gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <div>
        Esta factura tiene pagos por <strong>{formatCurrency(factura.pagado, factura.moneda)}</strong>.
        El nuevo total no puede quedar por debajo de lo ya pagado.
      </div>
    </div>
  );
}

function BannerReaprobacion({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="flex gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
      <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
      <div>
        Si cambias folio, fecha de emisión o algún importe, la factura volverá a estado <strong>Por aprobar</strong>.
      </div>
    </div>
  );
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

  // Aviso conservador: si la factura estaba aprobada y hubo cualquier cambio,
  // advertir que el backend puede regresarla a "Por aprobar".
  const aviso = factura?.estado_aprobacion === "aprobada" && ctl.hayCambios;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <DialogContent className={cn(dialogSize.xl, "max-h-[90vh] flex flex-col gap-0 p-0")}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          {factura && <HeaderTitulo factura={factura} total={ctl.total} moneda={moneda} />}
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
              <BannerPagos factura={factura} />
              <BannerReaprobacion visible={aviso} />
              <FacturaProveedorFormFields
                values={v}
                onChange={ctl.handleChange}
                onProveedor={ctl.handleProveedor}
                categorias={cats.data ?? []}
                total={ctl.total}
                errors={ctl.errors}
                proveedorReadOnly
                proveedorNombre={factura.proveedor_nombre}
              />
            </>
          )}
        </div>

        <div className="border-t bg-background">
          <TotalesFooter sub={sub} iva={iva} ret={ret} total={ctl.total} moneda={moneda} />
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
