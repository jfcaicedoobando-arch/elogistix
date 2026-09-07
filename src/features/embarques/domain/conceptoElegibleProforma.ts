/**
 * R179-02 — Criterio único de elegibilidad de un concepto de venta para entrar
 * en una proforma nueva.
 *
 * Es el espejo cliente del candado del RPC `LC_CONCEPTOS_YA_ASIGNADOS`:
 * sólo entran los conceptos `pendiente` y sin vínculo a proforma. Antes la UI
 * usaba `estado_facturacion !== 'en_proforma'`, que admitía los `facturado` y
 * los pendientes ya vinculados: el modal los preseleccionaba y el contador
 * ofrecía proformas imposibles.
 */
export interface ConceptoElegibleLike {
  estado_facturacion?: string | null;
  proforma_id?: string | null;
}

export function esConceptoElegibleProforma(c: ConceptoElegibleLike): boolean {
  return c.estado_facturacion === "pendiente" && !c.proforma_id;
}
