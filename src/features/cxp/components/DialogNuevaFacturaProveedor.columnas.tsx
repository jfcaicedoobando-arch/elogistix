/**
 * Cuerpo del modal "Capturar factura de proveedor" (v13.422.0).
 *
 * Estructura: alertas de ancho completo → selector de origen → dos columnas
 * (izquierda: documento y partidas · derecha: datos de la factura y embarque).
 */
import type { useNuevaFacturaProveedorForm } from "@/features/cxp/hooks";
import type { useAutocargaEntrante } from "@/features/cxp/hooks/useAutocargaEntrante";
import type { CategoriaPresupuestoLite, EntranteParaCaptura } from "@/features/cxp/types";
import { EntranteCapturaBanner } from "./EntranteCapturaBanner";
import { OrigenDocumentoPicker } from "./OrigenDocumentoPicker";
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

/** Banda superior: avisos que aplican a todo el modal + origen del documento. */
export function BandaOrigenYAlertas({
  ctl, entrante, autocarga, onVerFacturaDuplicada,
}: Omit<Props, "categorias" | "keyRenglonSospechoso">) {
  return (
    <div className="space-y-4">
      <EntranteCapturaBanner
        entrante={entrante}
        estado={autocarga.estado}
        mensaje={autocarga.mensaje}
      />
      <CfdiDuplicadoAlert factura={ctl.cfdiDuplicado} onVerFactura={onVerFacturaDuplicada} />
      <OrigenDocumentoPicker mode={ctl.mode} onModeChange={ctl.setMode} />
    </div>
  );
}

/** Columna izquierda: de dónde viene la factura, partidas, fechas e importes. */
export function ColumnaDocumento({
  ctl, categorias, keyRenglonSospechoso,
}: Omit<Props, "entrante" | "autocarga" | "onVerFacturaDuplicada">) {
  const sinPartidas =
    ctl.cfdiConceptos.length === 0 && ctl.conceptosManuales.conceptos.length === 0;

  return (
    <div className="space-y-5 min-w-0">
      <CargaCfdiSection
        mode={ctl.mode}
        categorias={categorias}
        onParsed={ctl.handleCfdiParsed}
        onPdfIaParsed={ctl.handlePdfIaParsed}
        cfdiReady={!!ctl.pendingCfdi && ctl.pendingCfdi.origen === "cfdi"}
        pdfIaReady={!!ctl.pendingCfdi && ctl.pendingCfdi.origen === "pdf_ia"}
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

      {sinPartidas && ctl.mode !== "manual" && (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          Sube el documento y aquí aparecerán las partidas de la factura.
        </p>
      )}

      {/* v13.423.0 — Fechas e importes viven aquí para no dejar hueca esta
          columna ni obligar a un scroll largo del lado derecho. */}
      <FechasEImportesBlock
        values={ctl.values}
        onChange={ctl.handleChange}
        errors={ctl.errors}
        tcOrigen={ctl.tcOrigen}
        tcFechaAplicada={ctl.tcFechaAplicada}
        onObtenerDof={ctl.obtenerDofManual}
        dofLoading={ctl.dofLoading}
      />
    </div>
  );
}

interface DatosProps {
  ctl: Ctl;
  categorias: CategoriaPresupuestoLite[];
}

/** Columna derecha: proveedor, categoría, notas y vinculación al embarque. */
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
        sinFechasEImportes
      />

      {ctl.values.provId ? (
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
      ) : (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
          Elige el proveedor para poder vincular la factura a un embarque.
        </p>
      )}
    </div>
  );
}

