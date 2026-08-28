/**
 * Importación del estado de cuenta BBVA desde un <input type="file">.
 * Extraído de TesoreriaConciliacion.tsx (v13.777.7) para respetar el límite
 * de 200 líneas por archivo productivo (Power of 10).
 */
import { useRef, type ChangeEvent, type RefObject } from "react";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/ui/appFeedback";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { parseEstadoCuentaBBVA } from "@/features/tesoreria/domain/import/bbva";
import { useImportarMovimientos } from "@/features/tesoreria/hooks";

interface Resultado {
  fileRef: RefObject<HTMLInputElement>;
  handleFile: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  importando: boolean;
}

export function useImportarEstadoCuenta(cuentaId: string): Resultado {
  const importar = useImportarMovimientos();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cuentaId) {
      if (!cuentaId) {
        notifyError(undefined, {
          title: "Selecciona una cuenta primero",
          method: "PAGES_TESORERIA_TESORERIACONCILIACION_1",
        });
      }
      return;
    }
    try {
      notifyInfo(undefined, { title: "Procesando archivo…" });
      const movimientos = await parseEstadoCuentaBBVA(file);
      if (movimientos.length === 0) {
        notifyError(undefined, {
          title: "No se encontraron movimientos válidos",
          method: "PAGES_TESORERIA_TESORERIACONCILIACION_2",
        });
        return;
      }
      const res = await importar.mutateAsync({ cuentaId, movimientos });
      notifySuccess(undefined, {
        title: `Importados ${res.nuevos} nuevos / ${res.duplicados} duplicados ignorados`,
      });
    } catch (err) {
      notifyError(undefined, {
        title: (err as Error).message,
        error: err,
        method: "PAGES_TESORERIA_TESORERIACONCILIACION_3",
      });
      reportCaughtError(err, { feature: "tesoreria", op: "importar_movimientos_bbva" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return { fileRef, handleFile, importando: importar.isPending };
}
