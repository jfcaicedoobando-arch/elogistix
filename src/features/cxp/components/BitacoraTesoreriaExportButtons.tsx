/**
 * Botones de descarga (CSV / PDF) de la bitácora de tesorería (v13.397.0).
 * Exporta exactamente los movimientos visibles con los filtros aplicados.
 */
import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { descargarBlob } from "@/lib/downloadBlob";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  bitacoraExportACsv,
  nombreArchivoBitacora,
  type FilaBitacoraExport,
} from "@/features/cxp/services/bitacoraTesoreriaExport";

interface Props {
  filas: FilaBitacoraExport[];
  folio: string;
  proveedor?: string;
  filtrosAplicados?: string;
}

export function BitacoraTesoreriaExportButtons({
  filas, folio, proveedor, filtrosAplicados,
}: Props) {
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const sinDatos = filas.length === 0;

  const descargarCsv = () => {
    try {
      const csv = bitacoraExportACsv(filas);
      // BOM para que Excel en Windows reconozca los acentos.
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      descargarBlob(blob, nombreArchivoBitacora(folio, "csv"));
      notifySuccess(undefined, { title: "Bitácora descargada en CSV" });
    } catch (error) {
      notifyError(undefined, {
        title: "No se pudo generar el CSV",
        error,
        method: "BITACORA_TESORERIA_CSV",
      });
    }
  };

  const descargarPdfBitacora = async () => {
    setGenerandoPdf(true);
    try {
      const [{ descargarPdf }, { BitacoraTesoreriaDocument }] = await Promise.all([
        import("@/pdf/render/descargarPdf"),
        import("@/pdf/documents/BitacoraTesoreriaDocument"),
      ]);
      await descargarPdf(
        <BitacoraTesoreriaDocument
          folio={folio}
          proveedor={proveedor}
          filtrosAplicados={filtrosAplicados}
          filas={filas}
        />,
        nombreArchivoBitacora(folio, "pdf"),
      );
      notifySuccess(undefined, { title: "Bitácora descargada en PDF" });
    } catch (error) {
      notifyError(undefined, {
        title: "No se pudo generar el PDF",
        error,
        method: "BITACORA_TESORERIA_PDF",
      });
    } finally {
      setGenerandoPdf(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={descargarCsv}
        disabled={sinDatos}
        title={sinDatos ? "No hay movimientos para exportar" : "Descargar CSV"}
      >
        <FileSpreadsheet className="h-4 w-4" aria-hidden />
        CSV
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={descargarPdfBitacora}
        disabled={sinDatos || generandoPdf}
        title={sinDatos ? "No hay movimientos para exportar" : "Descargar PDF"}
      >
        {generandoPdf ? (
          <Download className="h-4 w-4 animate-pulse" aria-hidden />
        ) : (
          <FileText className="h-4 w-4" aria-hidden />
        )}
        {generandoPdf ? "Generando…" : "PDF"}
      </Button>
    </div>
  );
}
