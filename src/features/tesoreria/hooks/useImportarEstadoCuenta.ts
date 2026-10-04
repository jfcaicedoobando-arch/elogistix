/** La selección prepara una revisión. Sólo la confirmación persiste el archivo. */
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { notifyError, notifyInfo, notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { getErrorMessage } from "@/lib/errors";
import { parseEstadoCuentaBBVA, type MovimientoParseado } from "@/features/tesoreria/domain/import/bbva";
import { firmaRevisionImportacion } from "@/features/tesoreria/domain/import/revisionImportacion";
import { revisarImportacion, type RevisionImportacion } from "@/features/tesoreria/services/revisionImportacion";
import { useImportarMovimientos } from "@/features/tesoreria/hooks";

export interface ImportacionPendiente extends RevisionImportacion {
  archivo: string;
  movimientos: MovimientoParseado[];
  sinImporte: number;
}

async function leerArchivoImportable(file: File) {
  const resultado = await parseEstadoCuentaBBVA(file);
  if (resultado.ilegibles.length > 0) {
    const detalle = resultado.ilegibles.slice(0, 3).map((f) => `fila ${f.fila}: ${f.motivo}`).join("; ");
    throw new Error(`No se importó nada: ${resultado.ilegibles.length} filas ilegibles (${detalle}). Corrígelas y vuelve a cargar el archivo.`);
  }
  if (!resultado.movimientos.length) throw new Error("No se encontraron movimientos válidos");
  return resultado;
}

function informarErrorImportacion(error: unknown) {
  const mensaje = getErrorMessage(error);
  const crudo = error && typeof error === "object" && "message" in error ? String(error.message) : mensaje;
  const title = /LC_IMPORTACION_REVISION_CAMBIO/.test(crudo)
    ? "Los datos bancarios cambiaron. Cancela y carga el archivo de nuevo para revisar sus coincidencias."
    : mensaje;
  notifyError(undefined, { title,
    error, method: "PAGES_TESORERIA_TESORERIACONCILIACION_3" });
  reportCaughtError(error, { feature: "tesoreria", op: "importar_movimientos_bbva" });
}

export function useImportarEstadoCuenta(cuentaId: string) {
  const importar = useImportarMovimientos();
  const fileRef = useRef<HTMLInputElement>(null);
  const solicitudRef = useRef(0);
  const confirmandoRef = useRef(false);
  const [procesando, setProcesando] = useState(false);
  const [revision, setRevision] = useState<ImportacionPendiente | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    solicitudRef.current++;
    setRevision(null);
    setProcesando(false);
  }, [cuentaId]);

  const cancelarRevision = () => {
    if (confirmandoRef.current) return;
    solicitudRef.current++;
    setRevision(null);
    setProcesando(false);
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cuentaId || confirmandoRef.current) {
      if (!cuentaId) notifyError(undefined, { title: "Selecciona una cuenta primero", method: "PAGES_TESORERIA_TESORERIACONCILIACION_1" });
      return;
    }
    const solicitud = ++solicitudRef.current;
    setProcesando(true);
    setRevision(null);
    try {
      notifyInfo(undefined, { title: "Leyendo el archivo para revisión." });
      const resultado = await leerArchivoImportable(file);
      const lectura = await revisarImportacion(cuentaId, resultado.movimientos);
      if (solicitud !== solicitudRef.current) return;
      setRevision({ ...lectura, archivo: file.name, movimientos: resultado.movimientos, sinImporte: resultado.sinImporte });
    } catch (error) {
      if (solicitud === solicitudRef.current) informarErrorImportacion(error);
    } finally {
      if (solicitud === solicitudRef.current) setProcesando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const confirmarRevision = async () => {
    if (!revision || revision.cuenta.id !== cuentaId || confirmandoRef.current || importar.isPending) return;
    const solicitud = solicitudRef.current;
    confirmandoRef.current = true;
    setConfirmando(true);
    try {
      const actual = await revisarImportacion(cuentaId, revision.movimientos);
      if (solicitud !== solicitudRef.current) return;
      if (actual.cuenta.moneda !== revision.cuenta.moneda
        || firmaRevisionImportacion(actual.resumen) !== firmaRevisionImportacion(revision.resumen)) {
        setRevision({ ...revision, ...actual });
        notifyWarning(undefined, { title: "Los datos bancarios cambiaron. Revisa el resumen actualizado y vuelve a confirmar." });
        return;
      }
      const res = await importar.mutateAsync({ cuentaId, movimientos: revision.movimientos, revision: actual.resumen.filas });
      const omitidas = revision.sinImporte > 0 ? ` · ${revision.sinImporte} filas sin importe omitidas` : "";
      notifySuccess(undefined, { title: `Importados ${res.nuevos} nuevos / ${res.duplicados} duplicados ignorados / ${res.vinculados ?? 0} vinculados${omitidas}` });
      if (solicitud === solicitudRef.current) setRevision(null);
    } catch (error) { if (solicitud === solicitudRef.current) informarErrorImportacion(error); }
    finally { confirmandoRef.current = false; setConfirmando(false); }
  };

  return { fileRef, handleFile, revision, cancelarRevision, confirmarRevision,
    importando: procesando || confirmando || importar.isPending, confirmando };
}
