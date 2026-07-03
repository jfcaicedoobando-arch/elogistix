/**
 * Captura de factura de proveedor — soporta captura manual y carga de XML CFDI.
 * Adopta el `FormDialogShell` para alinearse con Cliente/Proveedor:
 *  - Header con icon-tile + chip de Total.
 *  - Footer compuesto: resumen Subtotal/IVA/Ret arriba + acciones abajo.
 * Estado/submit en `useNuevaFacturaProveedorForm` (Power-of-10).
 */
import { Loader2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { formatCurrency } from "@/lib/formatters";
import { usePresupuestoCategorias } from "@/features/presupuesto/hooks";
import { useNuevaFacturaProveedorForm } from "@/features/cxp/hooks";
import { FacturaProveedorFormFields } from "./FacturaProveedorFormFields";
import { CargaCfdiSection } from "./CargaCfdiSection";
import { CrearProveedorDesdeCfdiDialog } from "./CrearProveedorDesdeCfdiDialog";
import { VincularEmbarqueSection } from "./VincularEmbarqueSection";
import type { EmbarqueSeleccionado } from "./SugerirEmbarqueBlock";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialEmbarqueAdHoc?: EmbarqueSeleccionado | null;
}

export function DialogNuevaFacturaProveedor({ open, onOpenChange, initialEmbarqueAdHoc }: Props) {
  const cats = usePresupuestoCategorias(true);
  const ctl = useNuevaFacturaProveedorForm(() => onOpenChange(false), initialEmbarqueAdHoc);

  const sub = Number(ctl.values.subtotal) || 0;
  const iva = Number(ctl.values.iva) || 0;
  const ret = Number(ctl.values.retenciones) || 0;
  const moneda = ctl.values.moneda;

  const headerAside = (
    <>
      <div className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Total {moneda}</div>
      <div className="text-2xl font-bold tabular-nums leading-tight">
        {formatCurrency(ctl.total, moneda)}
      </div>
    </>
  );

  const footer = (
    <div className="w-full flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs tabular-nums">
        <span className="text-muted-foreground">Subtotal: <span className="text-foreground font-medium">{formatCurrency(sub, moneda)}</span></span>
        <span className="text-muted-foreground">IVA: <span className="text-foreground font-medium">{formatCurrency(iva, moneda)}</span></span>
        <span className="text-muted-foreground">Ret: <span className="text-foreground font-medium">{formatCurrency(ret, moneda)}</span></span>
        <span className="text-muted-foreground">Total <span className="font-medium">{moneda}</span>: <span className="text-foreground text-base font-bold">{formatCurrency(ctl.total, moneda)}</span></span>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={ctl.isPending}>
          Cancelar
        </Button>
        <Button onClick={ctl.submit} disabled={ctl.isPending} className="shadow-sm">
          {ctl.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {ctl.isPending ? "Guardando…" : "Guardar factura"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <FormDialogShell
        open={open}
        onOpenChange={(o) => { if (!o) ctl.reset(); onOpenChange(o); }}
        icon={FileSpreadsheet}
        title="Capturar factura de proveedor"
        description="Registra la factura recibida. Si es de un proveedor mexicano, sube el XML CFDI y se prellenará automáticamente."
        size="xl"
        headerAside={headerAside}
        footer={footer}
      >
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
      </FormDialogShell>

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
