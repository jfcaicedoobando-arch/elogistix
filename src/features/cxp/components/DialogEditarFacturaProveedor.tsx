/**
 * Editor de factura de proveedor existente.
 * v13.303.98 · Design language "Card grid estructurada":
 *   - Chip-folio inline en el título.
 *   - KPI grid superior (Total emph, Subtotal, IVA, Ret) reemplaza headerAside.
 *   - Banners de pagos/re-aprobación unificados con banda de contexto.
 */
import { AlertTriangle, ShieldAlert, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogCancelarBoton } from "@/components/shared/FormDialogCancelarBoton";
import { formatCurrency } from "@/lib/formatters";
import { usePresupuestoCategorias } from "@/features/presupuesto/hooks";
import { useEditarFacturaProveedorForm } from "@/features/cxp/hooks";
import { FacturaProveedorFormFields } from "./FacturaProveedorFormFields";
import { Kpi } from "./DialogDetallePagosProveedor.parts";
import type { FacturaCxP } from "@/features/cxp/services";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

interface Props {
  factura: FacturaCxP | null;
  onOpenChange: (o: boolean) => void;
}

function BannerContexto({
  tone, icon: Icon, children,
}: {
  tone: "warn" | "primary";
  icon: typeof AlertTriangle;
  children: React.ReactNode;
}) {
  const cls = tone === "warn"
    ? "border-warning/30 bg-warning/5 text-warning"
    : "border-primary/30 bg-primary/5 text-primary";
  return (
    <div className={`flex gap-2 rounded-md border px-3 py-2 text-body-sm ${cls}`}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="text-foreground/90">{children}</div>
    </div>
  );
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
  const moneda = v.moneda ?? factura.moneda;
  const sub = Number(v.subtotal) || 0;
  const iva = Number(v.iva) || 0;
  const ret = Number(v.retenciones) || 0;
  return (
    <>
      <div className="flex items-center gap-3 flex-wrap -mt-1">
        <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-body-sm font-mono font-semibold uppercase tracking-wider border">
          {factura.folio_interno}
        </span>
        <span className="text-body-sm text-muted-foreground truncate">
          Folio prov. <span className="font-mono">{factura.folio_proveedor}</span> · {factura.proveedor_nombre}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
        <Kpi label="Subtotal" value={formatCurrency(sub, moneda)} />
        <Kpi label="IVA" value={formatCurrency(iva, moneda)} />
        <Kpi label="Retenciones" value={formatCurrency(ret, moneda)} />
        <Kpi label={`Total ${moneda}`} value={formatCurrency(ctl.total, moneda)} emphasis />
      </div>

      {factura.pagado > 0 && (
        <BannerContexto tone="warn" icon={AlertTriangle}>
          Esta factura tiene pagos por <strong>{formatCurrency(factura.pagado, factura.moneda)}</strong>.
          El nuevo total no puede quedar por debajo de lo ya pagado.
        </BannerContexto>
      )}
      {aviso && (
        <BannerContexto tone="primary" icon={ShieldAlert}>
          Si cambias folio, fecha de emisión o algún importe, la factura volverá a estado <strong>Por aprobar</strong>.
        </BannerContexto>
      )}

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

  const footer = (
    <>
      {/* v13.821.7 — Cancelar pasa por el cierre guardado del shell: con
          cambios sin guardar pide confirmación en vez de descartar directo. */}
      <FormDialogCancelarBoton onCancelar={() => onOpenChange(false)} disabled={ctl.isPending} />
      <Button onClick={ctl.submit} disabled={!ctl.hayCambios || !ctl.values} loading={ctl.isPending}>
        {ctl.isPending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </>
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(o) => { if (!o) onOpenChange(false); }}
      icon={FileSpreadsheet}
      title="Editar factura de proveedor"
      description="Corrige folio, fechas o importes. El proveedor y el CFDI fiscal no se pueden cambiar."
      size="xl"
      footer={footer}
      // YG-04: con cambios sin guardar, cerrar pide confirmación.
      isDirty={ctl.hayCambios}
    >
      {ctl.isLoadingRow && (
        <div className="flex items-center justify-center py-12 text-body text-muted-foreground">
          <EmptyStateInline loading message="Cargando factura…" />
        </div>
      )}

      {ctl.isErrorRow && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-body text-destructive">
          No se pudo cargar la factura. Cierra y vuelve a abrir el diálogo.
        </div>
      )}

      {!ctl.isLoadingRow && factura && (
        <EditorBody factura={factura} ctl={ctl} categorias={cats.data ?? []} />
      )}
    </FormDialogShell>
  );
}
