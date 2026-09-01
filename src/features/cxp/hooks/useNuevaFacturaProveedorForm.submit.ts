/**
 * Orquestación del submit de captura de factura de proveedor.
 * Extraído para respetar Power-of-10 (≤200 líneas por archivo).
 */

import { buscarFacturaDuplicadaFolio } from "@/features/cxp/services";
import {
  buscarCfdiDuplicado, describirFacturaExistente, type FacturaExistentePorUuid,
} from "./useNuevaFacturaProveedorForm.dup";

import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import type { FacturaFormValues } from "@/features/cxp/types";
import type { EmbarqueSeleccionado } from "@/features/cxp/types";
import { buildPayload, type PendingCfdi, type VinculoLinea } from "./useNuevaFacturaProveedorForm.helpers";
import {
  uploadCfdiSafe, vincularSafe, persistirConceptosCfdiSafe, buildFacturaSuccessDescription,
  aprenderAliasProveedorSafe,
} from "./useNuevaFacturaProveedorForm.sideEffects";
import type { CfdiConceptoParsed } from "@/features/cxp/services";
import { getErrorMessage } from "@/lib/errors";

/** Acción "Ver factura" del toast de CFDI duplicado (v13.368.0). */
function accionVerFactura(f: FacturaExistentePorUuid) {
  return {
    label: "Ver factura",
    onClick: () => { window.location.assign(`/compras/facturas/${f.id}`); },
  };
}

function notificarCfdiDuplicado(f: FacturaExistentePorUuid, method: string, sufijo: string) {
  notifyError(undefined, {
    title: "Este CFDI ya está capturado",
    description: `Ya existe como ${describirFacturaExistente(f)}. ${sufijo}`,
    method,
    action: accionVerFactura(f),
  });
}

export async function handleSubmitError(e: unknown, uuidFiscal?: string | null) {
  const err = e as { message?: string; code?: string; details?: string; constraint?: string };
  const blob = `${err.message ?? ""} ${err.details ?? ""} ${err.constraint ?? ""}`.toLowerCase();
  if (err.code === "23505" && /uuid_fiscal/.test(blob)) {
    const r = await buscarCfdiDuplicado(uuidFiscal);
    if (r.estado === "existe") {
      notificarCfdiDuplicado(r.factura, "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_1",
        "Búscala en Compras › Facturas en vez de volver a capturarla.");
    } else {
      notifyError(undefined, {
        title: "Este CFDI ya está capturado",
        description: "Ya existe una factura viva con este UUID fiscal, pero no tienes permiso para verla o la consulta falló. Pide a un administrador que la revise en Compras › Facturas.",
        method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_1",
      });
    }
  } else if (err.code === "23502" && /categoria_presupuesto_id/.test(blob)) {
    // P0-2 (R5): NOT NULL de la categoría contable — mensaje de negocio correcto.
    notifyError(undefined, {
      title: "Falta la categoría contable",
      description: "Selecciona la categoría de presupuesto antes de guardar la factura.",
      method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_CATEGORIA",
    });
  } else if (err.code === "23505" && /proveedor_facturas_org_prov_folio_uq/.test(blob)) {
    // P1-2: la llave única es proveedor + folio + fecha de emisión (vivas).
    notifyError(undefined, {
      title: "Folio duplicado para este proveedor",
      description: "Ya existe una factura viva con este folio y fecha de emisión para el proveedor. Cambia el folio o la fecha, o busca la factura existente en Compras › Facturas.",
      method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_FOLIO",
    });
  } else if (err.code === "23505") {
    notifyError(undefined, { title: "Registro duplicado", description: getErrorMessage(err), method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_DUP2" });
  } else {
    // P0-2 (R5): fallback genérico — nunca reutilizar un toast de negocio.
    notifyError(undefined, {
      title: "No se pudo capturar la factura",
      description: getErrorMessage(err),
      method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_2",
    });
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
  /** v13.820.5 — Embarque del documento del buzón CxP (herencia si no hay vínculos). */
  embarqueOrigenId?: string | null;
  crearMutateAsync: (payload: ReturnType<typeof buildPayload>) => Promise<{ id?: string } | null | undefined>;
  setFolioError: () => void;
}

export interface ResultadoSubmit {
  ok: boolean;
  /** Id de la factura creada; lo usa la captura desde el buzón CxP (v13.366.0). */
  facturaId: string | null;
}

/** Devuelve `ok: true` y el id creado si la operación fue exitosa. */
export async function runSubmit(p: RunSubmitParams): Promise<ResultadoSubmit> {
  // P0-2 (R5): defensa en profundidad — `categoria_presupuesto_id` es NOT NULL en BD;
  // si el string llega vacío, el INSERT falla con 23502 y el toast confunde al usuario.
  if (!p.values.categoriaId) {
    notifyError(undefined, {
      title: "Falta la categoría contable",
      description: "Selecciona la categoría de presupuesto antes de guardar la factura.",
      method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_CATEGORIA_PRE",
    });
    return { ok: false, facturaId: null };
  }
  try {
    const dup = await buscarFacturaDuplicadaFolio(p.values.provId, p.values.folio, p.values.emision);
    if (dup) {
      p.setFolioError();
      notifyError(undefined, {
        title: "Factura duplicada",
        description: `Ya existe como ${describirFacturaExistente(dup)} con el folio ${p.values.folio.trim()} y fecha ${p.values.emision}. Si es un documento distinto, corrige el folio o la fecha de emisión.`,
        method: "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_DUP",
        action: accionVerFactura(dup),
      });
      return { ok: false, facturaId: null };
    }
  } catch {
    // Si la verificación falla (red, RLS), continuamos: el UNIQUE de UUID fiscal sigue protegiendo.
  }

  const previo = await buscarCfdiDuplicado(p.pendingCfdi?.uuid);
  if (previo.estado === "existe") {
    notificarCfdiDuplicado(previo.factura, "FEATURES_CXP_HOOKS_USENUEVAFACTURAPROVEEDORFORM_UUID_PRE",
      "No se creó un duplicado.");
    return { ok: false, facturaId: null };
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
      // v13.415.0: aprendemos cómo se llama el proveedor en SUS documentos para
      // que la próxima factura PDF se empareje sola (facturas sin Tax ID).
      await aprenderAliasProveedorSafe({
        values: p.values, pendingCfdi: p.pendingCfdi,
        organizationId: p.organizationId, userId: p.userId,
      });
    }
    notifySuccess(undefined, {
      title: "Factura de proveedor capturada",
      description: buildFacturaSuccessDescription(sideResult),
    });
    return { ok: true, facturaId: created?.id ?? null };
  } catch (e) {
    await handleSubmitError(e, p.pendingCfdi?.uuid);
    return { ok: false, facturaId: null };
  }
}
