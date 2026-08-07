/**
 * Botones de descarga (CSV / PDF) del estado de cuenta bancario (v13.450.0).
 */
import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { descargarBlob } from "@/lib/downloadBlob";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  estadoCuentaACsv,
  filasEstadoCuentaExport,
  nombreArchivoEstadoCuenta,
  resumenEstadoCuenta,
} from "@/features/tesoreria/services/estadoCuentaExport";
import type { EstadoCuentaBancario, MovimientoEstadoCuenta } from "@/features/tesoreria/domain/estadoCuenta";

interface Props {
  estado: EstadoCuentaBancario;
  /** Movimientos visibles (ya filtrados en pantalla). */
  movimientos: MovimientoEstadoCuenta[];
}

export function EstadoCuentaExportButtons({ estado, movimientos }: Props) {
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const sinDatos = movimientos.length === 0;
  const filas = filasEstadoCuentaExport(movimientos, estado.moneda);

  const descargarCsv = () => {
    try {
      const csv = estadoCuentaACsv(filas);
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
      descargarBlob(blob, nombreArchivoEstadoCuenta(estado.alias, estado.desde, estado.hasta, "csv"));
      notifySuccess(undefined, { title: "Estado de cuenta descargado en CSV" });
    } catch (error) {
      notifyError(undefined, {
        title: "No se pudo generar el CSV",
        error,
        method: "ESTADO_CUENTA_CSV",
      });
    }
  };

  const descargarPdfEstado = async () => {
    setGenerandoPdf(true);
    try {
      const [{ descargarPdf }, { EstadoCuentaBancarioDocument }] = await Promise.all([
        import("@/pdf/render/descargarPdf"),
        import("@/pdf/documents/EstadoCuentaBancarioDocument"),
      ]);
      await descargarPdf(
        <EstadoCuentaBancarioDocument
          cuenta={estado.alias}
          banco={estado.banco}
          moneda={estado.moneda}
          resumen={resumenEstadoCuenta(estado)}
          filas={filas}
        />,
        nombreArchivoEstadoCuenta(estado.alias, estado.desde, estado.hasta, "pdf"),
      );
      notifySuccess(undefined, { title: "Estado de cuenta descargado en PDF" });
    } catch (error) {
      notifyError(undefined, {
        title: "No se pudo generar el PDF",
        error,
        method: "ESTADO_CUENTA_PDF",
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
        title={sinDatos ? "No hay movimientos para exportar" : "Descargar CSV"}
      >
        <FileSpreadsheet className="h-4 w-4" aria-hidden />
        CSV
      </Button>
      <Button
        type="button" variant="outline" size="sm"
        onClick={descargarPdfEstado} disabled={sinDatos || generandoPdf}
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
