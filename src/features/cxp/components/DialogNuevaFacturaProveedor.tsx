/**
 * Captura de factura de proveedor — soporta captura manual y carga de XML CFDI.
 * v13.303.98 · Design language "Card grid estructurada": KPI grid superior
 * (Total con emphasis, Subtotal, IVA, Retenciones) reemplaza al headerAside
 * de texto plano y a la fila de totales del footer.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { formatCurrency } from "@/lib/formatters";
import { usePresupuestoCategorias } from "@/features/presupuesto/hooks";
import { usePermissions } from "@/hooks/shared";
import { useNuevaFacturaProveedorForm } from "@/features/cxp/hooks";
import { FacturaProveedorFormFields } from "./FacturaProveedorFormFields";
import { CargaCfdiSection } from "./CargaCfdiSection";
import { CfdiDuplicadoAlert } from "./CfdiDuplicadoAlert";
import { CfdiConceptosPreview } from "./CfdiConceptosPreview";
import { ConceptosManualesSection } from "./ConceptosManualesSection";
import { CrearProveedorDesdeCfdiDialog } from "./CrearProveedorDesdeCfdiDialog";
import { VincularEmbarqueSection } from "./VincularEmbarqueSection";
import { CuadreConceptosBar } from "./CuadreConceptosBar";
import { Kpi } from "./DialogDetallePagosProveedor.parts";
import { calcularCuadreConceptos, type ConceptoParaCuadre } from "@/features/cxp/utils/cuadreConceptos";
import type { EmbarqueSeleccionado } from "@/features/cxp/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialEmbarqueAdHoc?: EmbarqueSeleccionado | null;
}

/**
 * Fuente de verdad de las partidas que alimentan el cuadre contra el subtotal:
 * CFDI > conceptos manuales (Q-02, v13.339.0) > montos vinculados a embarques.
 */
function resolverConceptosParaCuadre(
  cfdi: ReadonlyArray<{ importe?: number | string | null; cantidad?: number | null }>,
  manuales: ReadonlyArray<{ importe?: number | string | null; cantidad?: number | null }>,
  vinculos: Record<string, { monto?: number | string | null }>,
): ConceptoParaCuadre[] {
  const fuente = cfdi.length > 0 ? cfdi : manuales;
  if (fuente.length > 0) {
    return fuente.map((c) => ({ monto: Number(c.importe) || 0, cantidad: c.cantidad }));
  }
  return Object.values(vinculos).map((v) => ({ monto: Number(v.monto) || 0 }));
}

export function DialogNuevaFacturaProveedor({ open, onOpenChange, initialEmbarqueAdHoc }: Props) {
  const navigate = useNavigate();
  const { canCapturarFacturaProveedor } = usePermissions();
  const cats = usePresupuestoCategorias(true);
  const ctl = useNuevaFacturaProveedorForm(() => onOpenChange(false), initialEmbarqueAdHoc);

  const sub = Number(ctl.values.subtotal) || 0;
  const iva = Number(ctl.values.iva) || 0;
  const ieps = Number(ctl.values.ieps) || 0;
  const ret = Number(ctl.values.retenciones) || 0;
  const moneda = ctl.values.moneda;

  const conceptosParaCuadre = useMemo<ConceptoParaCuadre[]>(
    () => resolverConceptosParaCuadre(ctl.cfdiConceptos, ctl.conceptosManuales.conceptos, ctl.vinculos),
    [ctl.cfdiConceptos, ctl.conceptosManuales.conceptos, ctl.vinculos],
  );
  const cuadre = useMemo(() => calcularCuadreConceptos(sub, conceptosParaCuadre), [sub, conceptosParaCuadre]);

  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={ctl.isPending}>
        Cancelar
      </Button>
      <Button onClick={ctl.submit} disabled={!ctl.puedeGuardar || !canCapturarFacturaProveedor}>
        {ctl.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {ctl.isPending ? "Guardando…" : "Guardar factura"}
      </Button>
    </>
  );

  // R-05.2: sin permiso mostramos el motivo en vez de un formulario que la
  // base de datos rechazará al guardar.
  if (open && !canCapturarFacturaProveedor) {
    return <DialogFacturaProveedorSinPermiso open={open} onOpenChange={onOpenChange} />;
  }



  return (
    <>
      <FormDialogShell
        open={open}
        onOpenChange={(o) => { if (!o) ctl.reset(); onOpenChange(o); }}
        icon={FileSpreadsheet}
        title="Capturar factura de proveedor"
        description="Registra la factura recibida. Si es de un proveedor mexicano, sube el XML CFDI y se prellenará automáticamente."
        size="xl"
        footer={footer}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 -mt-1">
          <Kpi label="Subtotal" value={formatCurrency(sub, moneda)} />
          <Kpi label="IVA" value={formatCurrency(iva, moneda)} />
          <Kpi label={ieps > 0 ? "IEPS" : "Retenciones"} value={formatCurrency(ieps > 0 ? ieps : ret, moneda)} />
          <Kpi label={`Total ${moneda}`} value={formatCurrency(ctl.total, moneda)} emphasis />
        </div>

        <CargaCfdiSection
          mode={ctl.mode}
          onModeChange={ctl.setMode}
          categorias={cats.data ?? []}
          onParsed={ctl.handleCfdiParsed}
          onPdfIaParsed={ctl.handlePdfIaParsed}
          cfdiReady={!!ctl.pendingCfdi && ctl.pendingCfdi.origen === "cfdi"}
          pdfIaReady={!!ctl.pendingCfdi && ctl.pendingCfdi.origen === "pdf_ia"}
        />

        <CfdiDuplicadoAlert
          factura={ctl.cfdiDuplicado}
          onVerFactura={(id) => {
            ctl.reset();
            onOpenChange(false);
            navigate(`/compras/facturas?factura=${id}`);
          }}
        />

        <CfdiConceptosPreview conceptos={ctl.cfdiConceptos} moneda={ctl.values.moneda} />

        <ConceptosManualesSection
          oculta={ctl.cfdiConceptos.length > 0}
          conceptos={ctl.conceptosManuales.conceptos}
          moneda={ctl.values.moneda}
          onAgregar={ctl.conceptosManuales.agregar}
          onActualizar={ctl.conceptosManuales.actualizar}
          onEliminar={ctl.conceptosManuales.eliminar}
        />

        <FacturaProveedorFormFields
          values={ctl.values}
          onChange={ctl.handleChange}
          onProveedor={ctl.handleProveedor}
          categorias={cats.data ?? []}
          total={ctl.total}
          errors={ctl.errors}
          tcOrigen={ctl.tcOrigen}
          tcFechaAplicada={ctl.tcFechaAplicada}
          onObtenerDof={ctl.obtenerDofManual}
          dofLoading={ctl.dofLoading}
        />

        <VincularEmbarqueSection
          proveedorId={ctl.values.provId}
          proveedorNombre={ctl.values.provNombre}
          organizationId={ctl.organizationId}
          seleccion={ctl.vinculos}
          onToggle={ctl.toggleVinculo}
          onChangeMonto={ctl.setVinculoMonto}
          onAplicarSugerencias={ctl.aplicarSugerencias}
          facturaDescripcion={ctl.values.notas || `Factura ${ctl.values.folio}`}
          facturaMonto={Number(ctl.values.subtotal) || 0}
          facturaMoneda={ctl.values.moneda}
          embarqueAdHoc={ctl.embarqueAdHoc}
          onEmbarqueAdHoc={ctl.setEmbarqueAdHoc}
        />

        <CuadreConceptosBar resultado={cuadre} subtotal={sub} moneda={moneda} />
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
