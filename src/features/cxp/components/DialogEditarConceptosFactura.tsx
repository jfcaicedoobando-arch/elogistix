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
import { useConceptosManuales } from "@/features/cxp/hooks/useConceptosManuales";
import { useConceptosCfdiFactura } from "@/features/cxp/hooks/useConceptosCfdiFactura";
import { useEditarConceptosFactura } from "@/features/cxp/hooks/useEditarConceptosFactura";
import { sumarConceptos } from "@/features/cxp/utils/cuadreConceptos";
import { formatCurrency } from "@/lib/formatters";
import { parseMonto } from "@/lib/format/parseMonto";
import { impuestosNoDesglosados, importesConceptosEditados } from "../utils/impuestosConceptos";
import { ImportesEdicionConceptos } from "./ImportesEdicionConceptos";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facturaId: string;
  folio: string;
  moneda: string;
  /** Subtotal actual de la cabecera; se muestra sólo como referencia previa. */
  subtotal: number;
  iva?: number;
  ieps?: number;
  retenciones?: number;
  total?: number;
}

export function DialogEditarConceptosFactura({
  open, onOpenChange, facturaId, folio, moneda, subtotal, iva = 0, ieps = 0, retenciones = 0, total,
}: Props) {
  const { data: actuales = [], isLoading, isError } = useConceptosCfdiFactura(open ? facturaId : null);
  const api = useConceptosManuales();
  const { mutateAsync, isPending } = useEditarConceptosFactura(facturaId);
  const [precargado, setPrecargado] = useState(false);
  const [globales, setGlobales] = useState({ iva: "0", ieps: "0" });
  const [mostrarGlobales, setMostrarGlobales] = useState(false);

  useEffect(() => {
    if (!open) {
      setPrecargado(false);
      api.limpiar();
      return;
    }
    if (precargado || isLoading || isError) return;
    const global = impuestosNoDesglosados(actuales, { iva, ieps });
    setGlobales({ iva: String(global.iva), ieps: String(global.ieps) });
    setMostrarGlobales(global.iva !== 0 || global.ieps !== 0);
    api.reemplazar(actuales.map((c) => ({
      descripcion: c.descripcion ?? "",
      cantidad: Number(c.cantidad) || 1,
      clave_unidad: c.clave_unidad ?? undefined,
      importe: Number(c.monto) || 0,
      iva: Number(c.iva) || 0,
      ieps: Number(c.ieps) || 0,
    })));
    setPrecargado(true);
  }, [open, actuales, precargado, api, iva, ieps, isLoading, isError]);

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
  const impuestosGlobales = { iva: parseMonto(globales.iva), ieps: parseMonto(globales.ieps) };
  const anterior = { subtotal, iva, ieps, retenciones, total: total ?? subtotal + iva + ieps - retenciones };
  const nuevo = importesConceptosEditados(api.conceptos.map((c) => ({
    monto: c.importe, cantidad: c.cantidad, iva: c.iva, ieps: c.ieps,
  })), impuestosGlobales, retenciones);
  const globalInvalido = Object.values(globales).some((v) => !v.trim() || !Number.isFinite(parseMonto(v, NaN)) || parseMonto(v) < 0);
  const cambiaImportes = (Object.keys(anterior) as Array<keyof typeof anterior>)
    .some((campo) => Math.abs(anterior[campo] - nuevo[campo]) > 0.005);

  const guardar = async () => {
    await mutateAsync({ folio, conceptos: api.conceptos, impuestosNoDesglosados: impuestosGlobales });
    onOpenChange(false);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={ListPlus}
      title={`Editar conceptos · ${folio}`}
      description="Sólo aplica a facturas capturadas a mano, sin pagos y no canceladas. Revisa el desglose y los importes antes de guardar. El cambio queda en la bitácora."
      size="4xl"
      footer={
        <FormDialogFooter
          onCancel={() => onOpenChange(false)}
          onConfirm={guardar}
          confirmLabel={cambiaImportes ? "Guardar y actualizar importes" : "Guardar conceptos"}
          loading={isPending}
          disabled={api.conceptos.length === 0 || !precargado || isLoading || isError || globalInvalido}
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
      {globalInvalido && <p role="alert" className="text-body-sm text-destructive">Revisa los impuestos globales: deben ser importes válidos, no negativos.</p>}
      <ImportesEdicionConceptos anterior={anterior} nuevo={nuevo} moneda={moneda}
        globales={globales} mostrarGlobales={mostrarGlobales}
        onGlobales={(campo, valor) => setGlobales((prev) => ({ ...prev, [campo]: valor }))} />
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
