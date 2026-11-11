import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { saveAs } from "file-saver";
import { AuthOperationChangedError, captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { todayLocalISO } from "@/lib/date/today";
import { getErrorMessage } from "@/lib/errors";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { facturas as facturasKeys } from "../queryKeys";
import { generarZipFacturas } from "../services/masivasZip";
import {
  marcarFacturasComoEnviadas,
  reenviarFacturasMasivas,
  type OpcionesFacturaMasiva,
  type ResultadoFacturaMasiva,
} from "../services/masivas";

type Accion = "zip" | "email" | "mark";

const ERRORES = {
  zip: { title: "No se pudo generar el ZIP", method: "FACTURAS_MASIVAS_ZIP" },
  email: { title: "No se pudo reenviar el lote", method: "FACTURAS_MASIVAS_REENVIAR" },
  mark: { title: "No se pudo marcar el lote", method: "FACTURAS_MASIVAS_MARCAR" },
};

function notificarMutacion(accion: "email" | "mark", resultados: ResultadoFacturaMasiva[]) {
  const errores = resultados.filter((resultado) => !resultado.ok);
  const confirmadas = resultados.length - errores.length;
  const verbo = accion === "email" ? "reenviadas" : "marcadas como enviadas";
  if (errores.length === 0) {
    notifySuccess(undefined, { title: `${confirmadas} factura(s) ${verbo}` });
    return;
  }
  const detalle = {
    method: ERRORES[accion].method,
    description: errores.slice(0, 3).map(({ facturaId, error }) => `${facturaId.slice(0, 8)}… ${error}`).join(" · "),
    context: { facturaIdsSinConfirmar: errores.map(({ facturaId }) => facturaId) },
  };
  if (confirmadas === 0) notifyError(undefined, { ...detalle, title: ERRORES[accion].title });
  else notifyWarning(undefined, { ...detalle, title: `${confirmadas} ${verbo} · ${errores.length} sin confirmar` });
}

export function useFacturasMasivas(selectedIds: ReadonlySet<string>, onMarked: (ids: readonly string[]) => void) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<Accion | null>(null);
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const ejecutando = useRef(false);
  const montado = useRef(false);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  async function ejecutar(
    accion: Accion,
    operacion: (ids: readonly string[], opciones: OpcionesFacturaMasiva) => Promise<void>,
  ) {
    if (ejecutando.current || selectedIds.size === 0) return;
    const ids = [...selectedIds];
    const scope = captureAuthOperationScope();
    ejecutando.current = true;
    setBusy(accion);
    setProgreso({ hechas: 0, total: ids.length });
    try {
      await operacion(ids, { scope, onProgress: (hechas, total) => {
        if (montado.current && scope.isCurrent()) setProgreso({ hechas, total });
      } });
    } catch (error) {
      if (scope.isCurrent() && !(error instanceof AuthOperationChangedError)) {
        notifyError(undefined, { ...ERRORES[accion], description: getErrorMessage(error), error, context: { total: ids.length } });
      }
    } finally {
      ejecutando.current = false;
      if (montado.current) {
        setBusy(null);
        setProgreso(null);
      }
    }
  }

  function descargarZip() {
    return ejecutar("zip", async (ids, opciones) => {
      const { archivo, facturas } = await generarZipFacturas(ids, opciones);
      opciones.scope.assertCurrent();
      const incompletas = facturas.filter(({ faltantes }) => faltantes.length > 0);
      const detalle = {
        method: ERRORES.zip.method,
        description: incompletas.slice(0, 3).map(({ numero, facturaId, faltantes }) =>
          `${numero ?? facturaId.slice(0, 8)}: falta ${faltantes.join(" y ").toUpperCase()}`).join(" · "),
        context: { incompletas: incompletas.map(({ facturaId, faltantes }) => ({ facturaId, faltantes })) },
      };
      if (!archivo) {
        notifyError(undefined, { ...detalle, title: "No hay PDF ni XML disponibles para la selección" });
        return;
      }
      saveAs(archivo, `facturas-${todayLocalISO()}.zip`);
      if (incompletas.length) {
        notifyWarning(undefined, { ...detalle, title: `ZIP descargado · ${incompletas.length} factura(s) incompletas` });
      } else {
        notifySuccess(undefined, { title: `${facturas.length} factura(s) descargadas` });
      }
    });
  }

  function mutar(accion: "email" | "mark") {
    return ejecutar(accion, async (ids, opciones) => {
      const resultados = accion === "email"
        ? await reenviarFacturasMasivas(ids, opciones)
        : await marcarFacturasComoEnviadas(ids, opciones.scope);
      opciones.scope.assertCurrent();
      const confirmadas = resultados.filter(({ ok }) => ok).map(({ facturaId }) => facturaId);
      if (confirmadas.length > 0) {
        void qc.invalidateQueries({ queryKey: facturasKeys.all });
        if (accion === "mark") onMarked(confirmadas);
      }
      notificarMutacion(accion, resultados);
    });
  }

  return { busy, progreso, descargarZip, reenviarEmail: () => mutar("email"), marcarEnviada: () => mutar("mark") };
}
