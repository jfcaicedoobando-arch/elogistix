/**
 * Aplicadores compartidos de resultados parseados (CFDI XML y PDF IA)
 * al estado del hook `useNuevaFacturaProveedorForm`.
 * Extraído (v13.317.9) para respetar Power of 10 #1 (≤200 líneas).
 */

import type { Dispatch, SetStateAction, MutableRefObject } from "react";
import type { CfdiParsedResponse, CfdiConceptoParsed } from "@/features/cxp/services";
import type { FacturaFormValues, TcOrigen } from "@/features/cxp/types";
import { notifyError, notifyInfo } from "@/lib/ui/appFeedback";
import { procesarCfdiParsed } from "./useNuevaFacturaProveedorForm.cfdi";
import { procesarPdfIaParsed } from "./useNuevaFacturaProveedorForm.pdfIa";
import type { PendingCfdi } from "./useNuevaFacturaProveedorForm.helpers";

export interface ParsedApplyDeps {
  organizationId: string | null;
  setValues: Dispatch<SetStateAction<FacturaFormValues>>;
  setErrors: Dispatch<SetStateAction<Partial<Record<keyof FacturaFormValues, string>>>>;
  setPendingCfdi: Dispatch<SetStateAction<PendingCfdi | null>>;
  setCfdiConceptos: Dispatch<SetStateAction<CfdiConceptoParsed[]>>;
  setAskCrearProv: Dispatch<SetStateAction<{ rfc: string; nombre: string } | null>>;
  setTcOrigen: Dispatch<SetStateAction<TcOrigen>>;
  setTcFechaAplicada: Dispatch<SetStateAction<string | undefined>>;
  manualTcRef: MutableRefObject<boolean>;
}

function applyResult(deps: ParsedApplyDeps, result: {
  values: FacturaFormValues;
  pendingCfdi: PendingCfdi | null;
  conceptos: CfdiConceptoParsed[];
  askCrearProv: { rfc: string; nombre: string } | null;
  tcOrigen: TcOrigen;
  tcFechaAplicada?: string | undefined;
}) {
  deps.setValues(result.values);
  deps.setErrors({});
  deps.setPendingCfdi(result.pendingCfdi);
  deps.setCfdiConceptos(result.conceptos);
  deps.setAskCrearProv(result.askCrearProv);
  deps.setTcOrigen(result.tcOrigen);
  deps.setTcFechaAplicada(result.tcFechaAplicada);
  deps.manualTcRef.current = false;
}

export async function aplicarCfdiParsed(
  deps: ParsedApplyDeps,
  data: CfdiParsedResponse,
  files: { xml: File; pdf: File | null },
): Promise<boolean> {
  const result = await procesarCfdiParsed(data, files, deps.organizationId);
  if (!result.ok) {
    notifyError(undefined, {
      title: "El CFDI no cuadra y no se puede registrar",
      description: result.cuadreError,
      method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_CUADRE",
    });
    return false;
  }
  applyResult(deps, result);
  return true;
}

export async function aplicarPdfIaParsed(
  deps: ParsedApplyDeps,
  data: CfdiParsedResponse,
  files: { pdf: File },
): Promise<boolean> {
  const result = await procesarPdfIaParsed(data, files, deps.organizationId);
  applyResult(deps, result);
  // v13.415.0: muchas facturas internacionales no imprimen Tax ID, así que el
  // proveedor se identifica por nombre/alias. Pedimos verificación explícita.
  if (result.matchOrigen === "nombre" || result.matchOrigen === "alias") {
    notifyInfo(undefined, {
      title: `Proveedor detectado por nombre: ${result.values.provNombre}`,
      description: "El documento no trae Tax ID; verifica que el proveedor sea el correcto antes de guardar.",
    });
  }
  // v13.414.0: si la IA no copió el folio literal del documento, no lo
  // inventamos: se pide capturarlo a mano para no chocar con otra factura.
  if (!result.values.folio.trim()) {
    deps.setErrors({
      folio: "Captura el folio tal como aparece impreso en el documento (la IA no lo detectó con certeza).",
    });
  }
  return true;
}


