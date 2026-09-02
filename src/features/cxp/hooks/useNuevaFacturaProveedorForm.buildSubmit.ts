/**
 * Ensambla la función `submit` de useNuevaFacturaProveedorForm: validaciones,
 * candados de tope/cuadre y disparo de la mutación. Extraído para respetar
 * Power-of-10 (≤200 líneas por archivo).
 */
import { notifyError } from "@/lib/ui/appFeedback";
import type { FacturaFormValues, EmbarqueSeleccionado } from "@/features/cxp/types";
import type { CfdiConceptoParsed } from "@/features/cxp/services";
import type { VinculosState } from "./useNuevaFacturaProveedorForm.vinculos";
import type { PendingCfdi } from "./useNuevaFacturaProveedorForm.helpers";
import type { FacturaExistentePorUuid } from "./useNuevaFacturaProveedorForm.dup";
import type { ResultadoTopeVinculacion } from "@/features/cxp/utils/topeVinculacion";
import type { ResultadoCuadre } from "@/features/cxp/utils/cuadreConceptos";
import type { ConceptosManualesApi } from "./useConceptosManuales";
import { runSubmit } from "./useNuevaFacturaProveedorForm.submit";
import type { buildPayload } from "./useNuevaFacturaProveedorForm.helpers";
import { puedeContinuarSubmit, puedeContinuarTope } from "./useNuevaFacturaProveedorForm.guard";

export interface BuildSubmitDeps {
  values: FacturaFormValues;
  total: number;
  userId?: string;
  organizationId?: string | null;
  pendingCfdi: PendingCfdi | null;
  cfdiConceptos: ReadonlyArray<CfdiConceptoParsed>;
  conceptosAPersistir: ReadonlyArray<CfdiConceptoParsed>;
  vinculos: VinculosState;
  embarqueAdHoc: EmbarqueSeleccionado | null;
  embarqueOrigenId: string | null;
  cfdiDuplicado: FacturaExistentePorUuid | null;
  topeVinculacion: ResultadoTopeVinculacion;
  cuadreManual: ResultadoCuadre;
  manuales: ConceptosManualesApi;
  validate: () => boolean;
  crearMutateAsync: (payload: ReturnType<typeof buildPayload>) => Promise<{ id?: string } | null | undefined>;
  setFolioError: () => void;
  onSuccess: (facturaId?: string | null) => void;
}

/** Crea la función `submit` con todos sus candados de validación (Q-02). */
export function crearSubmit(deps: BuildSubmitDeps): () => Promise<void> {
  return async () => {
    const {
      values, total, userId, organizationId, pendingCfdi, cfdiConceptos,
      conceptosAPersistir, vinculos, embarqueAdHoc, embarqueOrigenId,
      cfdiDuplicado, topeVinculacion, cuadreManual, manuales,
      validate, crearMutateAsync, setFolioError, onSuccess,
    } = deps;

    if (cfdiDuplicado) {
      notifyError(undefined, {
        title: "Este CFDI ya está capturado",
        method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_UUID_UI",
      });
      return;
    }
    if (!validate()) {
      notifyError(undefined, { title: "Revisa los campos marcados", method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_3" });
      return;
    }
    // Bloqueo de captura sin partidas o con partidas descuadradas (Q-02).
    const hayVinculos = Object.keys(vinculos).length > 0;
    if (!puedeContinuarTope(topeVinculacion, Number(values.subtotal) || 0, values.moneda)) {
      return;
    }
    if (!puedeContinuarSubmit({ cfdiConceptos, hayVinculos, manuales, cuadreManual, subtotal: Number(values.subtotal) || 0, moneda: values.moneda })) {
      return;
    }

    const res = await runSubmit({
      values, total, userId, organizationId,
      pendingCfdi, cfdiConceptos: conceptosAPersistir, vinculos, embarqueAdHoc,
      // v13.820.5 — Si la captura viene del buzón, la factura hereda el embarque
      // del documento aunque el usuario no marque conceptos.
      embarqueOrigenId,
      crearMutateAsync,
      setFolioError,
    });
    if (res.ok) onSuccess(res.facturaId);
  };
}
