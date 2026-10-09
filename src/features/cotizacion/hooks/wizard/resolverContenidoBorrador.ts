/** Restaurar no autoriza adoptar una versión nueva ni mezclar ventas de otra captura. */
import type { FilaCostoLocal, ConceptoVentaCotizacion } from "../../types";
import type { StoredDraft } from "./cotizacionDraftStorage";
import { leerVentasBorrador } from "./cotizacionDraftVentas";
import type { CotizacionDraftSnapshot } from "../../services/draftSnapshot";
import { prepararCostosConOrigen } from "../../domain/sincronizarVentasConCostos";
import { motivoBloqueoEdicionCotizacion } from "../../domain/estadosEditables";

function validarServidorBorrador(draft: StoredDraft, snapshot: CotizacionDraftSnapshot | null, organizationId?: string | null) {
  if (draft.cotizacionId) {
    if (!snapshot || snapshot.id !== draft.cotizacionId || snapshot.organization_id !== organizationId ||
      snapshot.deleted_at || motivoBloqueoEdicionCotizacion(snapshot) || !snapshot.updated_at) {
      throw new Error("La cotización no está disponible para restaurar en esta organización o ya no es editable.");
    }
    // Sin sello no podemos probar que los costos/formulario legacy correspondan
    // a las ventas actuales. Abrir la versión servidor es la salida segura.
    if (!draft.updatedAt || draft.updatedAt !== snapshot.updated_at) {
      throw new Error("La versión del borrador no coincide con el servidor. Abre los datos actuales; el borrador local se conserva.");
    }
  }
}

function baselineRestaurado(draft: StoredDraft, costos: FilaCostoLocal[], ventas: ConceptoVentaCotizacion[]) {
  if (draft.version === 4) return draft.costosSincronizados ?? [];
  return ventas.some(c => c.descripcion.trim()) ? costos : [];
}

export function resolverContenidoBorrador(draft: StoredDraft, snapshot: CotizacionDraftSnapshot | null, organizationId?: string | null) {
  validarServidorBorrador(draft, snapshot, organizationId);
  const ventas = draft.conceptosUSD && draft.conceptosMXN
    ? [...draft.conceptosUSD, ...draft.conceptosMXN]
    : leerVentasBorrador(snapshot?.conceptos_venta ?? []);
  if (!ventas) throw new Error("Las ventas guardadas no se pueden recuperar con seguridad. Abre los datos actuales.");
  const costos = draft.version === 4 ? draft.costosInternos : prepararCostosConOrigen(draft.costosInternos, ventas);
  return {
    costosInternos: costos,
    costosSincronizados: baselineRestaurado(draft, costos, ventas),
    conceptosUSD: ventas.filter(c => c.moneda === "USD"),
    conceptosMXN: ventas.filter(c => c.moneda === "MXN"),
    tipoCambioUsd: draft.version === 4 ? draft.tipoCambioUsd ?? null : snapshot?.tipo_cambio_usd ?? null,
    // Legacy nunca aseguró las ventas locales: volver a costos para revisarlas.
    currentStep: draft.version === 4 ? draft.currentStep : Math.min(draft.currentStep, 2),
    sello: snapshot?.updated_at ?? null,
  };
}
