/**
 * Editor de factura de proveedor existente. Reusa FacturaProveedorFormFields,
 * mantiene proveedor + CFDI como read-only y delega la lógica al hook
 * useEditarFacturaProveedorForm. Muestra banners cuando la factura tiene pagos
 * o cuando los cambios fuerzan re-aprobación.
 *
 * Sub-componentes presentacionales locales para mantener complejidad ≤ 16.
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

interface DerivedTotales {
  sub: number;
  iva: number;
  ret: number;
  moneda: string;
}

function HeaderTitulo({ factura, total, moneda }: { factura: FacturaCxP; total: number; moneda: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <DialogTitle>
          Editar factura — {factura.folio_interno ?? ""}
          {factura.folio_proveedor ? (
            <span className="text-muted-foreground font-normal text-base"> · Folio prov. {factura.folio_proveedor}</span>
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

function TotalesFooter({ tot, total }: { tot: DerivedTotales; total: number }) {
  return (
    <div className="px-6 pt-3 pb-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs tabular-nums">
      <span className="text-muted-foreground">Subtotal: <span className="text-foreground font-medium">{formatCurrency(tot.sub, tot.moneda)}</span></span>
      <span className="text-muted-foreground">IVA: <span className="text-foreground font-medium">{formatCurrency(tot.iva, tot.moneda)}</span></span>
      <span className="text-muted-foreground">Ret: <span className="text-foreground font-medium">{formatCurrency(tot.ret, tot.moneda)}</span></span>
      <span className="text-muted-foreground">Total: <span className="text-foreground font-semibold">{formatCurrency(total, tot.moneda)}</span></span>
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

function deriveTotales(
  v: { subtotal?: number | string; iva?: number | string; retenciones?: number | string; moneda?: string } | null,
  fallbackMoneda: string,
): DerivedTotales {
  if (!v) return { sub: 0, iva: 0, ret: 0, moneda: fallbackMoneda };
  return {
    sub: Number(v.subtotal) || 0,
    iva: Number(v.iva) || 0,
    ret: Number(v.retenciones) || 0,
    moneda: v.moneda ?? fallbackMoneda,
  };
}

interface EditorBodyProps {
  factura: FacturaCxP;
  ctl: ReturnType<typeof useEditarFacturaProveedorForm>;
  categorias: { id: string; nombre: string }[];
}

function EditorBody({ factura, ctl, categorias }: EditorBodyProps) {
  const v = ctl.values;
  if (!v) return null;
  const aviso = factura.estado_aprobacion === "aprobada" && ctl.hayCambios;
  return (
    <>
      <BannerPagos factura={factura} />
      <BannerReaprobacion visible={aviso} />
      <FacturaProveedorFormFields
        values={v}
        onChange={ctl.handleChange}
        onProveedor={ctl.handleProveedor}
        categorias={categorias}
        total={ctl.total}
        errors={ctl.errors}
        proveedorReadOnly
        proveedorNombre={factura.proveedor_nombre}
      />
    </>
  );
}

export function DialogEditarFacturaProveedor({ factura, onOpenChange }: Props) {
  const open = !!factura;
  const cats = usePresupuestoCategorias(true);
  const ctl = useEditarFacturaProveedorForm({
    factura,
    onDone: () => onOpenChange(false),
  });

  const tot = deriveTotales(ctl.values, factura?.moneda ?? "MXN");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <DialogContent className={cn(dialogSize.xl, "max-h-[90vh] flex flex-col gap-0 p-0")}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          {factura && <HeaderTitulo factura={factura} total={ctl.total} moneda={tot.moneda} />}
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

          {!ctl.isLoadingRow && factura && (
            <EditorBody factura={factura} ctl={ctl} categorias={cats.data ?? []} />
          )}
        </div>

        <div className="border-t bg-background">
          <TotalesFooter tot={tot} total={ctl.total} />
          <div className="px-6 py-3 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={ctl.isPending}>
              Cancelar
            </Button>
            <Button onClick={ctl.submit} disabled={ctl.isPending || !ctl.hayCambios || !ctl.values}>
              {ctl.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {ctl.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
