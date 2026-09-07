/**
 * Diálogo para corregir los conceptos de una factura de proveedor capturada a
 * mano (v13.628.0). Reutiliza la misma captura del modal de alta.
 *
 * v13.823.191 — El subtotal manda desde los renglones: al editar se muestra el
 * subtotal que quedará en la factura (Σ importe × cantidad) en lugar de
 * comparar contra el subtotal viejo de la cabecera, que nunca cambiaba y
 * marcaba un descuadre artificial.
 */
import { useEffect, useMemo, useState } from "react";
import { ListPlus } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { ConceptosManualesSection } from "@/features/cxp/components/ConceptosManualesSection";
import { CuadreConceptosChip } from "@/features/cxp/components/CuadreConceptosChip";
import { useConceptosManuales } from "@/features/cxp/hooks/useConceptosManuales";
import { useConceptosCfdiFactura } from "@/features/cxp/hooks/useConceptosCfdiFactura";
import { useEditarConceptosFactura } from "@/features/cxp/hooks/useEditarConceptosFactura";
import { sumarConceptos } from "@/features/cxp/utils/cuadreConceptos";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facturaId: string;
  folio: string;
  moneda: string;
  /** Subtotal actual de la cabecera; se muestra sólo como referencia previa. */
  subtotal: number;
}

export function DialogEditarConceptosFactura({
  open, onOpenChange, facturaId, folio, moneda, subtotal,
}: Props) {
  const { data: actuales = [] } = useConceptosCfdiFactura(open ? facturaId : null);
  const api = useConceptosManuales();
  const { mutateAsync, isPending } = useEditarConceptosFactura(facturaId);
  const [precargado, setPrecargado] = useState(false);

  useEffect(() => {
    if (!open) {
      setPrecargado(false);
      api.limpiar();
      return;
    }
    if (precargado || actuales.length === 0) return;
    api.reemplazar(actuales.map((c) => ({
      descripcion: c.descripcion ?? "",
      cantidad: Number(c.cantidad) || 1,
      clave_unidad: c.clave_unidad ?? undefined,
      importe: Number(c.monto) || 0,
      iva: Number(c.iva) || 0,
      ieps: Number(c.ieps) || 0,
    })));
    setPrecargado(true);
  }, [open, actuales, precargado, api]);

  const lineas = useMemo(
    () => api.conceptos.map((c) => ({
      key: c.key,
      monto: Number(c.importe) || 0,
      cantidad: Number(c.cantidad) || 1,
    })),
    [api.conceptos],
  );
  /** El subtotal que quedará en la factura al guardar (lo recalcula el servidor). */
  const subtotalNuevo = useMemo(() => sumarConceptos(lineas), [lineas]);
  const hayRenglonEnCero = lineas.some((l) => l.monto === 0);
  const cambia = Math.abs(subtotalNuevo - subtotal) > 0.005;

  const guardar = async () => {
    await mutateAsync({ folio, conceptos: api.conceptos });
    onOpenChange(false);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ListPlus}
      title={`Editar conceptos · ${folio}`}
      description="Sólo aplica a facturas capturadas a mano, sin pagos y no canceladas. El subtotal de la factura se recalcula con estos renglones. El cambio queda en la bitácora."
      size="xl"
      headerAside={
        <CuadreConceptosChip
          estado={api.conceptos.length === 0 ? "sin_conceptos" : "cuadrado"}
          suma={subtotalNuevo}
          subtotal={subtotalNuevo}
          diferencia={0}
          moneda={moneda}
        />
      }
      footer={
        <FormDialogFooter
          onCancel={() => onOpenChange(false)}
          onConfirm={guardar}
          confirmLabel="Guardar conceptos"
          loading={isPending}
          disabled={api.conceptos.length === 0}
        />
      }
    >
      {cambia && api.conceptos.length > 0 && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-body-sm leading-relaxed">
          Al guardar, el subtotal de la factura cambia de{" "}
          <strong className="tabular-nums">{formatCurrency(subtotal, moneda)}</strong> a{" "}
          <strong className="tabular-nums">{formatCurrency(subtotalNuevo, moneda)}</strong>.
        </div>
      )}
      {hayRenglonEnCero && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-body-sm leading-relaxed">
          Hay renglones con importe en cero: revísalos antes de guardar.
        </div>
      )}
      <ConceptosManualesSection
        conceptos={api.conceptos}
        moneda={moneda}
        onAgregar={api.agregar}
        onActualizar={api.actualizar}
        onEliminar={api.eliminar}
        onDuplicar={api.duplicar}
      />
    </FormDialogShell>
  );
}
