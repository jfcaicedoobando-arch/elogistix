/**
 * Editor de factura de proveedor existente. Reusa FacturaProveedorFormFields,
 * mantiene proveedor + CFDI como read-only y delega la lógica al hook
 * useEditarFacturaProveedorForm. Muestra banners cuando la factura tiene pagos
 * o cuando los cambios fuerzan re-aprobación.
 *
 * Migrado a `FormDialogShell` para alinear con los modales hermanos
 * (Nuevo/Editar Cliente, Nuevo/Editar Proveedor, Nueva Factura).
 */
import { Loader2, AlertTriangle, ShieldAlert, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
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
        tcOrigen={ctl.tcOrigen}
        tcFechaAplicada={ctl.tcFechaAplicada}
        onObtenerDof={ctl.obtenerDofManual}
        dofLoading={ctl.dofLoading}
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

  const title = factura ? (
    <>
      Editar factura — {factura.folio_interno ?? ""}
      {factura.folio_proveedor && (
        <span className="text-muted-foreground font-normal"> · Folio prov. {factura.folio_proveedor}</span>
      )}
    </>
  ) : "Editar factura";

  const headerAside = factura ? (
    <>
      <div className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Total {tot.moneda}</div>
      <div className="text-2xl font-bold tabular-nums leading-tight">{formatCurrency(ctl.total, tot.moneda)}</div>
    </>
  ) : undefined;

  const footer = (
    <div className="w-full flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs tabular-nums">
        <span className="text-muted-foreground">Subtotal: <span className="text-foreground font-medium">{formatCurrency(tot.sub, tot.moneda)}</span></span>
        <span className="text-muted-foreground">IVA: <span className="text-foreground font-medium">{formatCurrency(tot.iva, tot.moneda)}</span></span>
        <span className="text-muted-foreground">Ret: <span className="text-foreground font-medium">{formatCurrency(tot.ret, tot.moneda)}</span></span>
        <span className="text-muted-foreground">Total <span className="font-medium">{tot.moneda}</span>: <span className="text-foreground text-base font-bold">{formatCurrency(ctl.total, tot.moneda)}</span></span>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={ctl.isPending}>Cancelar</Button>
        <Button onClick={ctl.submit} disabled={ctl.isPending || !ctl.hayCambios || !ctl.values}>
          {ctl.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {ctl.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(o) => { if (!o) onOpenChange(false); }}
      icon={FileSpreadsheet}
      title={title}
      description="Corrige folio, fechas o importes. El proveedor y el CFDI fiscal no se pueden cambiar."
      size="xl"
      headerAside={headerAside}
      footer={footer}
    >
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
    </FormDialogShell>
  );
}
