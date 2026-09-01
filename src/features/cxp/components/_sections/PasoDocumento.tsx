/**
 * Paso 1 del wizard de captura: de dónde viene la factura y sus conceptos.
 * v13.712.0 — Antes era la columna izquierda de un layout de dos columnas; ahora
 * ocupa todo el ancho para que la tabla de conceptos no se corte.
 */
import type { useNuevaFacturaProveedorForm } from "@/features/cxp/hooks";
import type { useAutocargaEntrante } from "@/features/cxp/hooks/useAutocargaEntrante";
import type { CategoriaPresupuestoLite, EntranteParaCaptura } from "@/features/cxp/types";
import { EntranteCapturaBanner } from "../EntranteCapturaBanner";
import { DocumentoBuzonCard } from "../DocumentoBuzonCard";
import { OrigenDocumentoPicker } from "../OrigenDocumentoPicker";
import { CargaCfdiSection } from "../CargaCfdiSection";
import { CfdiDuplicadoAlert } from "../CfdiDuplicadoAlert";
import { ProveedorNoEncontradoAlert } from "../ProveedorNoEncontradoAlert";
import { CfdiConceptosPreview } from "../CfdiConceptosPreview";
import { ConceptosManualesSection } from "../ConceptosManualesSection";

type Ctl = ReturnType<typeof useNuevaFacturaProveedorForm>;
type Autocarga = ReturnType<typeof useAutocargaEntrante>;

interface Props {
  ctl: Ctl;
  categorias: CategoriaPresupuestoLite[];
  entrante: EntranteParaCaptura | null;
  autocarga: Autocarga;
  keyRenglonSospechoso: string | null;
  modoBuzon: boolean;
  onVerArchivoBuzon: (path: string, nombre: string) => void;
  onVerFacturaDuplicada: (id: string) => void;
}

export function PasoDocumento({
  ctl, categorias, entrante, autocarga, keyRenglonSospechoso, modoBuzon,
  onVerArchivoBuzon, onVerFacturaDuplicada,
}: Props) {
  const enBuzon = Boolean(modoBuzon && entrante);
  const sinPartidas =
    ctl.cfdiConceptos.length === 0 && ctl.conceptosManuales.conceptos.length === 0;

  return (
    <div className="space-y-5 min-w-0">
      {enBuzon && entrante ? (
        <DocumentoBuzonCard
          entrante={entrante}
          estado={autocarga.estado}
          mensaje={autocarga.mensaje}
          onVerArchivo={onVerArchivoBuzon}
        />
      ) : (
        <EntranteCapturaBanner
          entrante={entrante}
          estado={autocarga.estado}
          mensaje={autocarga.mensaje}
        />
      )}

      <CfdiDuplicadoAlert factura={ctl.cfdiDuplicado} onVerFactura={onVerFacturaDuplicada} />

      {!enBuzon && (
        <>
          <OrigenDocumentoPicker mode={ctl.mode} onModeChange={ctl.setMode} />
          <CargaCfdiSection
            mode={ctl.mode}
            categorias={categorias}
            onParsed={ctl.handleCfdiParsed}
            onPdfIaParsed={ctl.handlePdfIaParsed}
            cfdiReady={!!ctl.pendingCfdi && ctl.pendingCfdi.origen === "cfdi"}
            pdfIaReady={!!ctl.pendingCfdi && ctl.pendingCfdi.origen === "pdf_ia"}
          />
        </>
      )}

      {ctl.askCrearProv && (
        <ProveedorNoEncontradoAlert
          rfc={ctl.askCrearProv.rfc}
          nombre={ctl.askCrearProv.nombre}
        />
      )}

      {/* v13.823.21 — el desglose propuesto por IA sí se corrige aquí; el del XML CFDI no. */}
      <CfdiConceptosPreview
        conceptos={ctl.cfdiConceptos}
        moneda={ctl.values.moneda}
        onEditar={ctl.pendingCfdi?.origen === "pdf_ia" ? ctl.editarConceptoIa : undefined}
        onEliminar={ctl.pendingCfdi?.origen === "pdf_ia" ? ctl.eliminarConceptoIa : undefined}
      />

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

      {sinPartidas && (enBuzon || ctl.mode !== "manual") && (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-body-sm text-muted-foreground">
          Sube el documento y aquí aparecerán las partidas de la factura.
        </p>
      )}
    </div>
  );
}
