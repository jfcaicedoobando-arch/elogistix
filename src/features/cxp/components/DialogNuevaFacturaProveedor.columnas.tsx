/**
 * Columnas del modal "Capturar factura de proveedor" (v13.400.0).
 * Izquierda: documento origen y partidas. Derecha: datos de la factura y
 * vinculación al embarque. Extraído para mantener el diálogo ≤ 200 líneas.
 */
import type { useNuevaFacturaProveedorForm } from "@/features/cxp/hooks";
import type { useAutocargaEntrante } from "@/features/cxp/hooks/useAutocargaEntrante";
import type { CategoriaPresupuestoLite, EntranteParaCaptura } from "@/features/cxp/types";
import { EntranteCapturaBanner } from "./EntranteCapturaBanner";
import { CargaCfdiSection } from "./CargaCfdiSection";
import { CfdiDuplicadoAlert } from "./CfdiDuplicadoAlert";
import { CfdiConceptosPreview } from "./CfdiConceptosPreview";
import { ConceptosManualesSection } from "./ConceptosManualesSection";
import { FacturaProveedorFormFields } from "./FacturaProveedorFormFields";
import { VincularEmbarqueSection } from "./VincularEmbarqueSection";

type Ctl = ReturnType<typeof useNuevaFacturaProveedorForm>;
type Autocarga = ReturnType<typeof useAutocargaEntrante>;

interface Props {
  ctl: Ctl;
  categorias: CategoriaPresupuestoLite[];
  entrante: EntranteParaCaptura | null;
  autocarga: Autocarga;
  keyRenglonSospechoso: string | null;
  onVerFacturaDuplicada: (id: string) => void;
}

/** Columna izquierda: de dónde viene la factura y qué partidas trae. */
export function ColumnaDocumento({
  ctl, categorias, entrante, autocarga, keyRenglonSospechoso,
  onVerFacturaDuplicada,
}: Props) {
  return (
    <div className="space-y-5 min-w-0">
      <EntranteCapturaBanner
        entrante={entrante}
        estado={autocarga.estado}
        mensaje={autocarga.mensaje}
      />

      <CargaCfdiSection
        mode={ctl.mode}
        onModeChange={ctl.setMode}
        categorias={categorias}
        onParsed={ctl.handleCfdiParsed}
        onPdfIaParsed={ctl.handlePdfIaParsed}
        cfdiReady={!!ctl.pendingCfdi && ctl.pendingCfdi.origen === "cfdi"}
        pdfIaReady={!!ctl.pendingCfdi && ctl.pendingCfdi.origen === "pdf_ia"}
      />

      <CfdiDuplicadoAlert factura={ctl.cfdiDuplicado} onVerFactura={onVerFacturaDuplicada} />

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
    </div>
  );
}

interface DatosProps {
  ctl: Ctl;
  categorias: CategoriaPresupuestoLite[];
}

/** Columna derecha: datos fiscales de la factura y vinculación al embarque. */
export function ColumnaDatosFactura({ ctl, categorias }: DatosProps) {
  return (
    <div className="space-y-5 min-w-0">
      <FacturaProveedorFormFields
        values={ctl.values}
        onChange={ctl.handleChange}
        onProveedor={ctl.handleProveedor}
        categorias={categorias}
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
        tope={ctl.topeVinculacion}

      />
    </div>
  );
}
