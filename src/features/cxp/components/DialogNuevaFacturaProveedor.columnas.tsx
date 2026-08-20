/**
 * Cuerpo del modal "Capturar factura de proveedor" (v13.422.0).
 *
 * Estructura: alertas de ancho completo → selector de origen → dos columnas
 * (izquierda: documento y partidas · derecha: datos de la factura y embarque).
 *
 * v13.507.0 — Modo buzón: cuando el documento ya viene de operaciones se
 * esconden el selector de origen y la zona de carga (no hay nada que subir) y
 * en su lugar se muestra la tarjeta del documento con sus enlaces.
 */
import type { useNuevaFacturaProveedorForm } from "@/features/cxp/hooks";
import type { useAutocargaEntrante } from "@/features/cxp/hooks/useAutocargaEntrante";
import type { CategoriaPresupuestoLite, EntranteParaCaptura } from "@/features/cxp/types";
import { EntranteCapturaBanner } from "./EntranteCapturaBanner";
import { DocumentoBuzonCard } from "./DocumentoBuzonCard";
import { AvisoMontoDeclarado } from "./AvisoMontoDeclarado";
import { OrigenDocumentoPicker } from "./OrigenDocumentoPicker";
import { CargaCfdiSection } from "./CargaCfdiSection";
import { CfdiDuplicadoAlert } from "./CfdiDuplicadoAlert";
import { ProveedorNoEncontradoAlert } from "./ProveedorNoEncontradoAlert";
import { CfdiConceptosPreview } from "./CfdiConceptosPreview";
import { ConceptosManualesSection } from "./ConceptosManualesSection";
import { FechasEImportesBlock } from "./FacturaProveedorFechasImportes";

type Ctl = ReturnType<typeof useNuevaFacturaProveedorForm>;
type Autocarga = ReturnType<typeof useAutocargaEntrante>;

interface Props {
  ctl: Ctl;
  categorias: CategoriaPresupuestoLite[];
  entrante: EntranteParaCaptura | null;
  autocarga: Autocarga;
  keyRenglonSospechoso: string | null;
  onVerFacturaDuplicada: (id: string) => void;
  /** v13.507.0 — La captura nace de un documento del buzón. */
  modoBuzon?: boolean;
  onVerArchivoBuzon?: (path: string, nombre: string) => void;
}

/** Banda superior: avisos que aplican a todo el modal + origen del documento. */
export function BandaOrigenYAlertas({
  ctl, entrante, autocarga, onVerFacturaDuplicada, modoBuzon, onVerArchivoBuzon,
}: Omit<Props, "categorias" | "keyRenglonSospechoso">) {
  const enBuzon = Boolean(modoBuzon && entrante);
  return (
    <div className="space-y-4">
      {enBuzon && entrante ? (
        <DocumentoBuzonCard
          entrante={entrante}
          estado={autocarga.estado}
          mensaje={autocarga.mensaje}
          onVerArchivo={onVerArchivoBuzon ?? (() => undefined)}
        />
      ) : (
        <EntranteCapturaBanner
          entrante={entrante}
          estado={autocarga.estado}
          mensaje={autocarga.mensaje}
        />
      )}
      {enBuzon && entrante && (
        <AvisoMontoDeclarado
          montoDeclarado={entrante.montoDeclarado}
          monedaDeclarada={entrante.monedaDeclarada}
          montoCapturado={Number(ctl.values.subtotal) || 0}
          monedaCapturada={ctl.values.moneda}
        />
      )}
      <CfdiDuplicadoAlert factura={ctl.cfdiDuplicado} onVerFactura={onVerFacturaDuplicada} />
      {ctl.askCrearProv && (
        <ProveedorNoEncontradoAlert
          rfc={ctl.askCrearProv.rfc}
          nombre={ctl.askCrearProv.nombre}
        />
      )}
      {!enBuzon && <OrigenDocumentoPicker mode={ctl.mode} onModeChange={ctl.setMode} />}
    </div>
  );
}

/** Columna izquierda: de dónde viene la factura, partidas, fechas e importes. */
export function ColumnaDocumento({
  ctl, categorias, keyRenglonSospechoso, modoBuzon,
}: Omit<Props, "entrante" | "autocarga" | "onVerFacturaDuplicada" | "onVerArchivoBuzon">) {
  const sinPartidas =
    ctl.cfdiConceptos.length === 0 && ctl.conceptosManuales.conceptos.length === 0;

  return (
    <div className="space-y-5 min-w-0">
      {!modoBuzon && (
        <CargaCfdiSection
        mode={ctl.mode}
        categorias={categorias}
        onParsed={ctl.handleCfdiParsed}
        onPdfIaParsed={ctl.handlePdfIaParsed}
        cfdiReady={!!ctl.pendingCfdi && ctl.pendingCfdi.origen === "cfdi"}
        pdfIaReady={!!ctl.pendingCfdi && ctl.pendingCfdi.origen === "pdf_ia"}
        />
      )}

      <CfdiConceptosPreview conceptos={ctl.cfdiConceptos} moneda={ctl.values.moneda} />

      <ConceptosManualesSection
        oculta={ctl.cfdiConceptos.length > 0}
        conceptos={ctl.conceptosManuales.conceptos}
        moneda={ctl.values.moneda}
        keyResaltado={keyRenglonSospechoso}
        onAgregar={ctl.conceptosManuales.agregar}
        onActualizar={ctl.conceptosManuales.actualizar}
        onEliminar={ctl.conceptosManuales.eliminar}
        onDuplicar={ctl.conceptosManuales.duplicar}
      />

      {sinPartidas && (modoBuzon || ctl.mode !== "manual") && (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-body-sm text-muted-foreground">
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

export { ColumnaDatosFactura } from "./DialogNuevaFacturaProveedor.datos";
