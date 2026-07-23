/**
 * Hook para adjuntar / reemplazar / quitar el XML o PDF de una factura de
 * proveedor ya guardada (v13.307.5).
 *
 * Envuelve `adjuntarArchivoCfdiFactura` y `quitarArchivoCfdiFactura` con
 * React Query e invalida el detalle, listado y KPIs para que la UI refleje
 * el nuevo archivo sin recargar.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  adjuntarArchivoCfdiFactura,
  quitarArchivoCfdiFactura,
  type TipoAdjuntoCfdi,
} from "@/features/cxp/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

interface AdjuntarVars {
  facturaId: string;
  organizationId: string | null | undefined;
  tipo: TipoAdjuntoCfdi;
  file: File;
}

interface QuitarVars {
  facturaId: string;
  path: string;
  tipo: TipoAdjuntoCfdi;
}

function invalidar(qc: ReturnType<typeof useQueryClient>, facturaId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.cxp.factura(facturaId) });
  qc.invalidateQueries({ queryKey: queryKeys.cxp.all });
}

export function useAdjuntarArchivoCfdiFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: AdjuntarVars) => adjuntarArchivoCfdiFactura(vars),
    onSuccess: (_data, vars) => {
      invalidar(qc, vars.facturaId);
      notifySuccess(undefined, { title: `${vars.tipo} adjuntado` });
    },
    onError: (error: Error, vars) => {
      notifyError(undefined, {
        title: `No se pudo adjuntar el ${vars.tipo}: ${error.message}`,
        error,
        method: "CXP_ADJUNTAR_CFDI",
      });
    },
  });
}

export function useQuitarArchivoCfdiFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: QuitarVars) => quitarArchivoCfdiFactura(vars),
    onSuccess: (_data, vars) => {
      invalidar(qc, vars.facturaId);
      notifySuccess(undefined, { title: `${vars.tipo} quitado` });
    },
    onError: (error: Error, vars) => {
      notifyError(undefined, {
        title: `No se pudo quitar el ${vars.tipo}: ${error.message}`,
        error,
        method: "CXP_QUITAR_CFDI",
      });
    },
  });
}
