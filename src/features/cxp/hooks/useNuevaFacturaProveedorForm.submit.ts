/**
 * Orquestación del submit de captura de factura de proveedor.
 * Extraído para respetar Power-of-10 (≤200 líneas por archivo).
 */

import { existeFacturaDuplicada } from "@/features/cxp/services";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import type { FacturaFormValues } from "@/features/cxp/types";
import type { EmbarqueSeleccionado } from "@/features/cxp/types";
import { buildPayload, type PendingCfdi, type VinculoLinea } from "./useNuevaFacturaProveedorForm.helpers";
import {
  uploadCfdiSafe, vincularSafe, persistirConceptosCfdiSafe, buildFacturaSuccessDescription,
} from "./useNuevaFacturaProveedorForm.sideEffects";
import type { CfdiConceptoParsed } from "@/features/cxp/services";

export function handleSubmitError(e: unknown) {
  const err = e as { message?: string; code?: string; details?: string; constraint?: string };
  const blob = `${err.message ?? ""} ${err.details ?? ""} ${err.constraint ?? ""}`.toLowerCase();
  if (err.code === "23505" && /uuid_fiscal/.test(blob)) {
    notifyError(undefined, { title: "Ya existe una factura con este UUID fiscal (CFDI duplicado).", method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_1" });
  } else if (err.code === "23505" && /folio/.test(blob)) {
    notifyError(undefined, { title: "Ya existe una factura viva con este folio para el proveedor.", method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_FOLIO" });
  } else if (err.code === "23505") {
    notifyError(undefined, { title: "Registro duplicado", description: err.message ?? undefined, method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_DUP2" });
  } else {
    notifyError(undefined, { title: err.message ?? "Error al capturar", method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_2" });
  }
}

interface RunSubmitParams {
  values: FacturaFormValues;
  total: number;
  userId: string | undefined;
  organizationId: string | null;
  pendingCfdi: PendingCfdi | null;
  cfdiConceptos: ReadonlyArray<CfdiConceptoParsed>;
  vinculos: Record<string, VinculoLinea>;
  embarqueAdHoc: EmbarqueSeleccionado | null;
  crearMutateAsync: (payload: ReturnType<typeof buildPayload>) => Promise<{ id?: string } | null | undefined>;
  setFolioError: () => void;
}

/** Devuelve true si la operación fue exitosa. */
export async function runSubmit(p: RunSubmitParams): Promise<boolean> {
  try {
    const dup = await existeFacturaDuplicada(p.values.provId, p.values.folio, p.values.emision);
    if (dup) {
      p.setFolioError();
      notifyError(undefined, {
        title: "Factura duplicada",
        description: `Ya capturaste el folio ${p.values.folio.trim()} de este proveedor el ${p.values.emision}.`,
        method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_DUP",
      });
      return false;
    }
  } catch {
    // Si la verificación falla (red, RLS), continuamos: el UNIQUE de UUID fiscal sigue protegiendo.
  }
  try {
    const created = await p.crearMutateAsync(
      buildPayload({ values: p.values, total: p.total, userId: p.userId, pendingCfdi: p.pendingCfdi, vinculos: p.vinculos }),
    );
    let sideResult = {};
    if (created?.id) {
      await uploadCfdiSafe({ facturaId: created.id, organizationId: p.organizationId, pendingCfdi: p.pendingCfdi });
      await persistirConceptosCfdiSafe({
        facturaId: created.id, organizationId: p.organizationId, conceptos: p.cfdiConceptos,
      });
      sideResult = await vincularSafe({
        facturaId: created.id, organizationId: p.organizationId,
        values: p.values, total: p.total, vinculos: p.vinculos, embarqueAdHoc: p.embarqueAdHoc,
      });
    }
    notifySuccess(undefined, {
      title: "Factura de proveedor capturada",
      description: buildFacturaSuccessDescription(sideResult),
    });
    return true;
  } catch (e) {
    handleSubmitError(e);
    return false;
  }
}
