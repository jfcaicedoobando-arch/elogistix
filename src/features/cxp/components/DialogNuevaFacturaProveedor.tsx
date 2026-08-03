/**
 * Captura de factura de proveedor: manual, por XML CFDI, por PDF con IA o
 * desde el buzón CxP (v13.366.0). KPI grid superior con totales.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";

import { usePresupuestoCategorias } from "@/features/presupuesto/hooks";
import { usePermissions } from "@/hooks/shared";
import { DialogFacturaProveedorSinPermiso } from "@/features/cxp/components/DialogFacturaProveedorSinPermiso";
import { useNuevaFacturaProveedorForm } from "@/features/cxp/hooks";
import { FacturaProveedorFormFields } from "./FacturaProveedorFormFields";
import { CargaCfdiSection } from "./CargaCfdiSection";
import { CfdiDuplicadoAlert } from "./CfdiDuplicadoAlert";
import { CfdiConceptosPreview } from "./CfdiConceptosPreview";
import { ConceptosManualesSection } from "./ConceptosManualesSection";
import { CrearProveedorDesdeCfdiDialog } from "./CrearProveedorDesdeCfdiDialog";
import { VincularEmbarqueSection } from "./VincularEmbarqueSection";
import { CuadreConceptosBar } from "./CuadreConceptosBar";
import { FacturaProveedorTotalesKpis } from "./FacturaProveedorTotalesKpis";
import { calcularCuadreConceptos, type ConceptoParaCuadre } from "@/features/cxp/utils/cuadreConceptos";
import { resolverConceptosParaCuadre } from "@/features/cxp/utils/conceptosParaCuadre";
import { EntranteCapturaBanner } from "./EntranteCapturaBanner";
import { useAutocargaEntrante } from "@/features/cxp/hooks/useAutocargaEntrante";
import { useCapturaEntranteWiring } from "@/features/cxp/hooks/useCapturaEntranteWiring";
import type { EmbarqueSeleccionado, EntranteParaCaptura } from "@/features/cxp/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialEmbarqueAdHoc?: EmbarqueSeleccionado | null;
  /** v13.366.0 — Captura desde el buzón CxP: precarga y marca el documento. */
  entrante?: EntranteParaCaptura | null;
  onCapturada?: () => void;
}

/**
 * R-05.2: puerta de permisos. Sin capacidad de captura mostramos el motivo en
 * vez de un formulario que la base de datos rechazará al guardar.
 */
export function DialogNuevaFacturaProveedor(props: Props) {
  const { canCapturarFacturaProveedor } = usePermissions();
  if (!canCapturarFacturaProveedor) {
    return <DialogFacturaProveedorSinPermiso open={props.open} onOpenChange={props.onOpenChange} />;
  }
  return <DialogNuevaFacturaProveedorForm {...props} />;
}

function DialogNuevaFacturaProveedorForm({
  open, onOpenChange, initialEmbarqueAdHoc, entrante, onCapturada,
}: Props) {
  const navigate = useNavigate();
  const cats = usePresupuestoCategorias(true);
  const wiring = useCapturaEntranteWiring({
    entrante, initialEmbarqueAdHoc, onCapturada,
    onCerrar: () => onOpenChange(false),
  });
  const ctl = useNuevaFacturaProveedorForm(wiring.onDone, wiring.embarqueInicial);
  const autocarga = useAutocargaEntrante({
    entrante, abierto: open, categorias: cats.data ?? [],
    onCfdiParsed: ctl.handleCfdiParsed, onPdfParsed: ctl.handlePdfIaParsed,
  });

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

  // v13.399.0 — Con sobrante, señalamos el renglón manual de línea más alta:
  // es el candidato típico a "importe unitario capturado como total de línea".
  const keyRenglonSospechoso = useMemo(() => {
    if (cuadre.estado !== "sobrante") return null;
    const linea = (c: { importe?: number | string | null; cantidad?: number | null }) =>
      (Number(c.importe) || 0) * (Number(c.cantidad) || 1);
    return ctl.conceptosManuales.conceptos.reduce<{ key: string; total: number } | null>(
      (peor, c) => {
        const total = linea(c);
        return !peor || total > peor.total ? { key: c.key, total } : peor;
      },
      null,
    )?.key ?? null;
  }, [cuadre.estado, ctl.conceptosManuales.conceptos]);


  const footer = (
    <>
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={ctl.isPending}>
        Cancelar
      </Button>
      <Button onClick={ctl.submit} disabled={!ctl.puedeGuardar}>
        {ctl.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {ctl.isPending ? "Guardando…" : "Guardar factura"}
      </Button>
    </>
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
        footer={footer}
      >
        <EntranteCapturaBanner
          entrante={entrante ?? null}
          estado={autocarga.estado}
          mensaje={autocarga.mensaje}
        />

        <FacturaProveedorTotalesKpis
          subtotal={sub} iva={iva} ieps={ieps} retenciones={ret}
          total={ctl.total} moneda={moneda}
        />

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
          keyResaltado={keyRenglonSospechoso}
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

        <CuadreConceptosBar
          resultado={cuadre}
          subtotal={sub}
          moneda={moneda}
          renglones={conceptosParaCuadre.length}
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
