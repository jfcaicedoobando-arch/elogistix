/**
 * Botones de descarga (CSV / PDF) del estado de cuenta bancario (v13.450.0).
 */
import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";
import { descargarBlob } from "@/lib/downloadBlob";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  estadoCuentaACsv,
  filasEstadoCuentaExport,
  nombreArchivoEstadoCuenta,
  resumenEstadoCuenta,
  alcanceEstadoCuentaExport,
} from "@/features/tesoreria/services/estadoCuentaExport";
import type { EstadoCuentaBancario, MovimientoEstadoCuenta, FiltrosEstadoCuenta } from "@/features/tesoreria/domain/estadoCuenta";
import { cargarEmisorEntidad } from "@/pdf/emisor";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";

interface Props {
  estado: EstadoCuentaBancario;
  /** Movimientos visibles (ya filtrados en pantalla). */
  movimientos: MovimientoEstadoCuenta[];
  filtros: FiltrosEstadoCuenta;
}

export function EstadoCuentaExportButtons({ estado, movimientos, filtros }: Props) {
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const sinDatos = movimientos.length === 0 || estado.cobertura_historica === "sin_cobertura";
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
    const scope = captureAuthOperationScope();
    setGenerandoPdf(true);
    try {
      const [{ descargarPdf }, { EstadoCuentaBancarioDocument }, emisor] = await Promise.all([
        import("@/pdf/render/descargarPdf"),
        import("@/pdf/documents/EstadoCuentaBancarioDocument"),
        cargarEmisorEntidad("cuentas_bancarias", estado.cuenta_id),
      ]);
      scope.assertCurrent();
      await descargarPdf(
        <EstadoCuentaBancarioDocument
          cuenta={estado.alias}
          emisor={emisor}
          banco={estado.banco}
          moneda={estado.moneda}
          resumen={resumenEstadoCuenta(estado)}
          alcance={alcanceEstadoCuentaExport(estado, movimientos, filtros)}
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
      <Hint label={sinDatos ? "No hay movimientos para exportar" : "Descargar CSV"}>
        <Button
          type="button" variant="outline" size="sm"
          onClick={descargarCsv} disabled={sinDatos}
        >
          <FileSpreadsheet className="h-4 w-4" aria-hidden />
          CSV
        </Button>
      </Hint>
      <Hint label={sinDatos ? "No hay movimientos para exportar" : "Exportar PDF"}>
        <Button
          type="button" variant="outline" size="sm"
          onClick={descargarPdfEstado} disabled={sinDatos || generandoPdf}
        >
          {generandoPdf ? (
            <Download className="h-4 w-4 animate-pulse" aria-hidden />
          ) : (
            <FileText className="h-4 w-4" aria-hidden />
          )}
          {generandoPdf ? "Generando…" : "Exportar PDF"}
        </Button>
      </Hint>
    </div>
  );
}
