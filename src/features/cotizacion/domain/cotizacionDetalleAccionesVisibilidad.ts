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
}) {
  const {
    estado, esProspecto, tieneEmbarquesVinculados, puedeAceptar, puedeRechazar,
    puedeAltaCliente, tieneOportunidad, tieneVenta,
  } = params;
  const esAceptada = estado === "Aceptada";
  const respuestaEnSolicitada = puedeAceptar || puedeRechazar;
  return {
    esEnCaptura: estado === "Borrador" || estado === "Solicitada",
    mostrarAceptarRechazar:
      estado === "Borrador" || estado === "Enviada" ||
      (estado === "Solicitada" && respuestaEnSolicitada),
    esAceptada,
    // P0 — la puerta visible coincide con la cerradura: rol con alta de
    // clientes + prospecto aceptado + oportunidad ligada. Sin oportunidad queda
    // sólo el banner que guía a vincularla.
    mostrarConvertirCliente: esAceptada && esProspecto && puedeAltaCliente && tieneOportunidad,
    mostrarCrearEmbarque: esAceptada && !esProspecto && !tieneEmbarquesVinculados && tieneVenta,
    // P0 (bug 10): cotización aceptada sin venta capturada — se explica en vez
    // de ofrecer un botón que generaría un embarque en cero.
    mostrarFaltaVenta: esAceptada && !esProspecto && !tieneEmbarquesVinculados && !tieneVenta,
    mostrarRecotizar: esAceptada && !tieneEmbarquesVinculados,
  };
}
