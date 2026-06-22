/**
 * Captura de factura de proveedor — soporta captura manual y carga de XML CFDI.
 * Estado y submit viven en useNuevaFacturaProveedorForm para mantener el componente
 * bajo el límite Power of 10 (<200 líneas).
 */
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { usePresupuestoCategorias } from "@/features/presupuesto/hooks";
import { useNuevaFacturaProveedorForm } from "@/features/cxp/hooks";
import { FacturaProveedorFormFields } from "./FacturaProveedorFormFields";
import { CargaCfdiSection } from "./CargaCfdiSection";
import { CrearProveedorDesdeCfdiDialog } from "./CrearProveedorDesdeCfdiDialog";
import { VincularEmbarqueSection } from "./VincularEmbarqueSection";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function DialogNuevaFacturaProveedor({ open, onOpenChange }: Props) {
  const cats = usePresupuestoCategorias(true);
  const ctl = useNuevaFacturaProveedorForm(() => onOpenChange(false));

  const sub = Number(ctl.values.subtotal) || 0;
  const iva = Number(ctl.values.iva) || 0;
  const ret = Number(ctl.values.retenciones) || 0;
  const moneda = ctl.values.moneda;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) ctl.reset();
          onOpenChange(o);
        }}
      >
        <DialogContent
          className={cn(dialogSize.xl, "max-h-[90vh] flex flex-col gap-0 p-0")}
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle>Capturar factura de proveedor</DialogTitle>
                <DialogDescription>
                  Registra la factura recibida. Si es de un proveedor mexicano, sube el XML CFDI y se prellenará automáticamente.
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

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <CargaCfdiSection
              mode={ctl.mode}
              onModeChange={ctl.setMode}
              categorias={cats.data ?? []}
              onParsed={ctl.handleCfdiParsed}
              cfdiReady={!!ctl.pendingCfdi}
            />

            <FacturaProveedorFormFields
              values={ctl.values}
              onChange={ctl.handleChange}
              onProveedor={ctl.handleProveedor}
              categorias={cats.data ?? []}
              total={ctl.total}
              errors={ctl.errors}
            />

            <VincularEmbarqueSection
              proveedorId={ctl.values.provId}
              proveedorNombre={ctl.values.provNombre}
              organizationId={ctl.organizationId}
              seleccion={ctl.vinculos}
              onToggle={ctl.toggleVinculo}
              onChangeMonto={ctl.setVinculoMonto}
              embarqueAdHoc={ctl.embarqueAdHoc}
              onEmbarqueAdHoc={ctl.setEmbarqueAdHoc}
            />
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
              <Button onClick={ctl.submit} disabled={ctl.isPending}>
                {ctl.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {ctl.isPending ? "Guardando…" : "Guardar factura"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {ctl.askCrearProv && (
        <CrearProveedorDesdeCfdiDialog
          open={!!ctl.askCrearProv}
          onOpenChange={(o) => { if (!o) ctl.setAskCrearProv(null); }}
          rfc={ctl.askCrearProv.rfc}
          nombre={ctl.askCrearProv.nombre}
          organizationId={ctl.organizationId}
          onCreated={(id, nombre) => {
            ctl.handleProveedor(id, nombre);
            ctl.setAskCrearProv(null);
          }}
        />
      )}
    </>
  );
}
