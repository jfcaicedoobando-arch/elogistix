/**
 * Captura de una factura de proveedor directamente desde el buzón CxP.
 *
 * v13.366.0 — Antes de abrir el formulario se pasa por la puerta de validación
 * `validar_captura_entrante`: rol, organización, estado del documento y CFDI
 * duplicado. Si la puerta cierra, se explica el motivo y no se abre nada.
 */
import { useCallback, useState } from "react";
import { notifyError, notifyWarning } from "@/lib/ui/appFeedback";
import { validarCapturaEntrante } from "@/features/cxp/services/capturaEntrante";
import type { FacturaEntranteRow } from "@/features/cxp/services/facturasEntrantes";
import type { EntranteParaCaptura } from "@/features/cxp/types";

function aEntranteParaCaptura(row: FacturaEntranteRow): EntranteParaCaptura {
  return {
    id: row.id,
    embarqueId: row.embarque_id,
    expediente: row.embarques?.expediente ?? null,
    archivoPath: row.archivo_path,
    nombreArchivo: row.nombre_archivo,
    xmlPath: row.xml_path ?? null,
    xmlNombre: row.xml_nombre ?? null,
    totalDetectado: row.total_detectado ?? null,
    monedaDetectada: row.moneda_detectada ?? null,
  };
}

export function useCapturaDesdeBuzon() {
  const [entrante, setEntrante] = useState<EntranteParaCaptura | null>(null);
  const [validando, setValidando] = useState(false);

  const iniciar = useCallback(async (row: FacturaEntranteRow) => {
    setValidando(true);
    try {
      const res = await validarCapturaEntrante(row.id);
      if (!res.ok) {
        const dup = res.facturaDuplicada;
        notifyWarning(undefined, {
          title: "Este documento aún no se puede capturar",
          description: res.motivos.join(" · ") || "Revisa el estado del documento.",
          action: dup
            ? {
                label: "Ver factura",
                onClick: () => { window.location.assign(`/compras/facturas/${dup.id}`); },
              }
            : undefined,
        });
        return;
      }
      setEntrante(aEntranteParaCaptura(row));
    } catch (error) {
      notifyError(undefined, {
        title: "No se pudo validar el documento",
        error,
        method: "VALIDAR_CAPTURA_ENTRANTE",
      });
    } finally {
      setValidando(false);
    }
  }, []);

  const cerrar = useCallback(() => setEntrante(null), []);

  return { entrante, validando, iniciar, cerrar };
}
