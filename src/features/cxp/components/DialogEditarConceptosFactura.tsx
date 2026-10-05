/**
 * Diálogo para corregir los conceptos de una factura de proveedor capturada a
 * mano (v13.628.0). Reutiliza la misma captura del modal de alta.
 *
 * v13.823.191 — El subtotal manda desde los renglones: al editar se muestra el
 * subtotal que quedará en la factura (Σ importe × cantidad) en lugar de
 * comparar contra el subtotal viejo de la cabecera, que nunca cambiaba y
 * marcaba un descuadre artificial.
 */
import { useEffect, useState } from "react";
import { ListPlus } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogFooter } from "@/components/shared/FormDialogFooter";
import { ConceptosManualesSection } from "@/features/cxp/components/ConceptosManualesSection";
import { useConceptosManuales } from "@/features/cxp/hooks/useConceptosManuales";
import { useConceptosFacturaSnapshot } from "@/features/cxp/hooks/useConceptosFacturaSnapshot";
import { useEditarConceptosFactura } from "@/features/cxp/hooks/useEditarConceptosFactura";
import { formatCurrency } from "@/lib/formatters";
import { impuestosNoDesglosados } from "../utils/impuestosConceptos";
import { edicionConceptosResumen, puedeGuardarConceptos, referenciaEdicionConceptos } from "../utils/edicionConceptosResumen";
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
  const { data: snapshot, isLoading, isError } = useConceptosFacturaSnapshot(open ? facturaId : null);
  const [revision, setRevision] = useState<typeof snapshot>();
  const actuales = snapshot?.conceptos;
  const api = useConceptosManuales();
  const { mutateAsync, isPending } = useEditarConceptosFactura(facturaId);
  const [precargado, setPrecargado] = useState(false);
  const [globales, setGlobales] = useState({ iva: "0", ieps: "0" });
  const [mostrarGlobales, setMostrarGlobales] = useState(false);

  useEffect(() => {
    if (!open) {
      setPrecargado(false);
      setRevision(undefined);
      api.limpiar();
      return;
    }
    if (precargado || isLoading || isError || !snapshot || !actuales) return;
    setRevision(snapshot);
    const global = impuestosNoDesglosados(actuales, { iva: snapshot.factura.iva, ieps: snapshot.factura.ieps });
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
  }, [open, actuales, snapshot, precargado, api, isLoading, isError]);

  const { monedaMostrada, anterior } = referenciaEdicionConceptos(revision?.factura,
    { subtotal, iva, ieps, retenciones, total: total ?? subtotal + iva + ieps - retenciones }, moneda);
  const { subtotalNuevo, hayRenglonEnCero, impuestosGlobales, cambia, nuevo,
    globalInvalido, cambiaImportes } = edicionConceptosResumen(api.conceptos, globales, anterior);

  const guardar = async () => {
    try {
      await mutateAsync({ folio, conceptos: api.conceptos, impuestosNoDesglosados: impuestosGlobales,
        expectedUpdatedAt: revision?.factura.updated_at });
      onOpenChange(false);
    } catch { /* El hook mantiene el diálogo abierto y muestra el conflicto. */ }
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
          disabled={!puedeGuardarConceptos({ cantidad: api.conceptos.length, precargado, isLoading, isError, globalInvalido })}
        />
      }
    >
      {isError && <p role="alert" className="text-body-sm text-destructive">No se pudo cargar una versión consistente de la factura. Cierra este diálogo y vuelve a abrirlo para revisar los conceptos actuales.</p>}
      {cambia && api.conceptos.length > 0 && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-body-sm leading-relaxed">
          Al guardar, el subtotal de la factura cambia de{" "}
          <strong className="tabular-nums">{formatCurrency(anterior.subtotal, monedaMostrada)}</strong> a{" "}
          <strong className="tabular-nums">{formatCurrency(subtotalNuevo, monedaMostrada)}</strong>.
        </div>
      )}
      {hayRenglonEnCero && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-body-sm leading-relaxed">
          Hay renglones con importe en cero: revísalos antes de guardar.
        </div>
      )}
      {globalInvalido && <p role="alert" className="text-body-sm text-destructive">Revisa los impuestos globales: deben ser importes válidos, no negativos.</p>}
      <ImportesEdicionConceptos anterior={anterior} nuevo={nuevo} moneda={monedaMostrada}
        globales={globales} mostrarGlobales={mostrarGlobales}
        onGlobales={(campo, valor) => setGlobales((prev) => ({ ...prev, [campo]: valor }))} />
      <ConceptosManualesSection
        conceptos={api.conceptos}
        moneda={monedaMostrada}
        onAgregar={api.agregar}
        onActualizar={api.actualizar}
        onEliminar={api.eliminar}
        onDuplicar={api.duplicar}
      />
    </FormDialogShell>
  );
}
