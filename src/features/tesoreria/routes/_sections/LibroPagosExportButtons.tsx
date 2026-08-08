/**
 * Botones de descarga (CSV / PDF) del libro maestro de pagos.
 */
import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { descargarBlob } from "@/lib/downloadBlob";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  filasLibroPagosExport,
  libroPagosACsv,
  nombreArchivoLibroPagos,
  resumenLibroPagos,
} from "@/features/tesoreria/services/libroPagosExport";
import type { PagoLibro, TotalesLibroPagos } from "@/features/tesoreria/domain/libroPagos";
import type { RangoPagos } from "@/features/tesoreria/domain/libroPagosRangos";

interface Props {
  pagos: PagoLibro[];
  rango: RangoPagos;
  totales: TotalesLibroPagos;
}

export function LibroPagosExportButtons({ pagos, rango, totales }: Props) {
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const sinDatos = pagos.length === 0;
  const filas = filasLibroPagosExport(pagos);

  const descargarCsv = () => {
    try {
      const csv = libroPagosACsv(filas);
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      descargarBlob(blob, nombreArchivoLibroPagos(rango.desde, rango.hasta, "csv"));
      notifySuccess(undefined, { title: "Libro de pagos descargado en CSV" });
    } catch (error) {
      notifyError(undefined, {
        title: "No se pudo generar el CSV",
        error,
        method: "LIBRO_PAGOS_CSV",
      });
    }
  };

  const descargarPdfPagos = async () => {
    setGenerandoPdf(true);
    try {
      const [{ descargarPdf }, { LibroPagosDocument }] = await Promise.all([
        import("@/pdf/render/descargarPdf"),
        import("@/pdf/documents/LibroPagosDocument"),
      ]);
      await descargarPdf(
        <LibroPagosDocument
          resumen={resumenLibroPagos(rango.desde, rango.hasta, totales)}
          filas={filas}
        />,
        nombreArchivoLibroPagos(rango.desde, rango.hasta, "pdf"),
      );
      notifySuccess(undefined, { title: "Libro de pagos descargado en PDF" });
    } catch (error) {
      notifyError(undefined, {
        title: "No se pudo generar el PDF",
        error,
        method: "LIBRO_PAGOS_PDF",
      });
    } finally {
      setGenerandoPdf(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button" variant="outline" size="sm"
        onClick={descargarCsv} disabled={sinDatos}
        title={sinDatos ? "No hay pagos para exportar" : "Descargar CSV"}
      >
        <FileSpreadsheet className="h-4 w-4" aria-hidden />
        CSV
      </Button>
      <Button
        type="button" variant="outline" size="sm"
        onClick={descargarPdfPagos} disabled={sinDatos || generandoPdf}
        title={sinDatos ? "No hay pagos para exportar" : "Descargar PDF"}
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
