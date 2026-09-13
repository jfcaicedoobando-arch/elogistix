/**
 * Visibilidad de los botones del encabezado de cotización. Función pura,
 * extraída de `CotizacionDetalleSecciones` para bajar la complejidad del
 * componente (Power-of-10).
 * Nota: sólo se puede re-cotizar si aún no hay embarque generado; con embarque
 * vivo el flujo correcto es crear una nueva cotización.
 */
export function visibilidadAcciones(params: {
  estado: string;
  esProspecto: boolean;
  tieneEmbarquesVinculados: boolean;
  puedeAceptar: boolean;
  puedeRechazar: boolean;
  puedeAltaCliente: boolean;
  tieneOportunidad: boolean;
  /** P0 — sin venta capturada no se puede generar el embarque. */
  tieneVenta: boolean;
  /**
   * v13.823.277 — ¿el rol puede generar el embarque borrador? Espejo de
   * `crear_embarque_borrador_core` (admin/operador/super_admin): sin esto,
   * comercial y finanzas veían un botón que terminaba en 42501.
   */
  puedeCrearEmbarque: boolean;
  /**
   * v13.823.346 — ¿el rol puede escribir cotizaciones? Espejo de
   * `archivar_version_cotizacion`: sin esto finanzas veía "Re-cotizar" y la RPC
   * respondía 42501.
   */
  puedeRecotizar: boolean;
}) {
  const {
    estado, esProspecto, tieneEmbarquesVinculados, puedeAceptar, puedeRechazar,
    puedeAltaCliente, tieneOportunidad, tieneVenta, puedeCrearEmbarque, puedeRecotizar,
  } = params;
  const esAceptada = estado === "Aceptada";
  const respuestaEnSolicitada = puedeAceptar || puedeRechazar;
  const puertaEmbarque = puedeGenerarEmbarque({
    estado, tieneEmbarquesVinculados, esProspecto, puedeCrearEmbarque,
  });
  return {
    esEnCaptura: estado === "Borrador" || estado === "Solicitada",
    // v13.823.277 — el bloque sólo aparece si el rol tiene al menos una de las
    // dos acciones permitidas (antes se mostraba vacío para finanzas).
    mostrarAceptarRechazar:
      respuestaEnSolicitada &&
      (estado === "Borrador" || estado === "Enviada" || estado === "Solicitada"),
    esAceptada,
    // P0 — la puerta visible coincide con la cerradura: rol con alta de
    // clientes + prospecto aceptado + oportunidad ligada. Sin oportunidad queda
    // sólo el banner que guía a vincularla.
    mostrarConvertirCliente: esAceptada && esProspecto && puedeAltaCliente && tieneOportunidad,
    mostrarCrearEmbarque: puertaEmbarque && tieneVenta,
    // P0 (bug 10): cotización aceptada sin venta capturada — se explica en vez
    // de ofrecer un botón que generaría un embarque en cero. Sólo a quien
    // podría crear el embarque le sirve ese aviso.
    mostrarFaltaVenta: puertaEmbarque && !tieneVenta,
    // Re-cotizar exige estado Aceptada (espejo de `recotizar_cotizacion`).
    mostrarRecotizar: esAceptada && !tieneEmbarquesVinculados && puedeRecotizar,
  };
}

/**
 * v13.823.347 — `crear_embarque_borrador_core` acepta Aceptada o En operación;
 * la puerta visible coincide con la RPC (antes una cotización En operación sin
 * embarque no ofrecía acción y el aviso apuntaba a un botón inexistente).
 */
function puedeGenerarEmbarque(p: {
  estado: string;
  tieneEmbarquesVinculados: boolean;
  esProspecto: boolean;
  puedeCrearEmbarque: boolean;
}): boolean {
  const esConvertible = p.estado === "Aceptada" || p.estado === "En operación";
  return esConvertible && !p.tieneEmbarquesVinculados && !p.esProspecto && p.puedeCrearEmbarque;
}
