import type { ConceptoVentaCotizacion, DimensionLCL, DimensionAerea } from '@/hooks/useCotizaciones';
import type { CotizacionFormValues } from '@/hooks/useCotizacionWizardForm';

/**
 * Construye el payload de datos generales (Paso 1) para crear/actualizar una cotización.
 * Función pura sin dependencias de React.
 */
export function buildPaso1Data(
  values: CotizacionFormValues,
  clientes: { id: string; nombre: string }[],
  userEmail: string,
): Record<string, unknown> {
  const v = values;
  const cliente = clientes.find(c => c.id === v.clienteId);
  let pesoFinal = v.pesoKg;
  let volumenFinal = v.volumenM3;
  let piezasFinal = v.piezas;
  const _esMaritimo = v.modo === 'Marítimo';
  const _esAereo = v.modo === 'Aéreo';

  if (_esMaritimo) {
    pesoFinal = 0;
    volumenFinal = v.tipoEmbarque === 'LCL'
      ? v.dimensionesLCL.reduce((s, d) => s + d.volumen_m3, 0)
      : 0;
    piezasFinal = v.tipoEmbarque === 'LCL'
      ? v.dimensionesLCL.reduce((s, d) => s + d.piezas, 0)
      : 0;
  } else if (_esAereo) {
    pesoFinal = v.dimensionesAereas.reduce((s, d) => s + d.peso_volumetrico_kg, 0);
    volumenFinal = 0;
    piezasFinal = v.dimensionesAereas.reduce((s, d) => s + d.piezas, 0);
  }

  return {
    es_prospecto: v.esProspecto,
    cliente_id: v.esProspecto ? null : v.clienteId,
    cliente_nombre: v.esProspecto ? v.prospectoEmpresa : (cliente?.nombre ?? ''),
    prospecto_empresa: v.esProspecto ? v.prospectoEmpresa : '',
    prospecto_contacto: v.esProspecto ? v.prospectoContacto : '',
    prospecto_email: v.esProspecto ? v.prospectoEmail : '',
    prospecto_telefono: v.esProspecto ? v.prospectoTelefono : '',
    modo: v.modo,
    tipo: v.tipo,
    incoterm: v.incoterm,
    descripcion_mercancia: v.sectorEconomico,
    peso_kg: pesoFinal,
    volumen_m3: volumenFinal,
    piezas: piezasFinal,
    origen: v.origen,
    destino: v.destino,
    conceptos_venta: [] as ConceptoVentaCotizacion[],
    subtotal: 0,
    moneda: 'USD',
    vigencia_dias: v.validezPropuesta
      ? Math.max(1, Math.ceil((v.validezPropuesta.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 15,
    notas: v.notas,
    operador: userEmail,
    tipo_carga: v.tipoCarga,
    msds_archivo: null as string | null,
    tipo_embarque: _esMaritimo ? v.tipoEmbarque : 'FCL',
    tipo_contenedor: _esMaritimo && v.tipoEmbarque === 'FCL' ? v.tipoContenedor : null,
    tipo_peso: _esMaritimo && v.tipoEmbarque === 'FCL' ? v.tipoPeso : 'Peso Normal',
    descripcion_adicional: v.descripcionAdicional,
    sector_economico: v.sectorEconomico,
    dimensiones_lcl: (_esMaritimo && v.tipoEmbarque === 'LCL' ? v.dimensionesLCL : []) as DimensionLCL[],
    dimensiones_aereas: (_esAereo ? v.dimensionesAereas : []) as DimensionAerea[],
    dias_libres_destino: _esMaritimo && v.tipoEmbarque === 'FCL' ? v.diasLibresDestino : 0,
    dias_almacenaje: _esMaritimo && v.tipoEmbarque === 'LCL' ? v.diasAlmacenaje : 0,
    carta_garantia: _esMaritimo && v.tipoEmbarque === 'FCL' ? v.cartaGarantia : false,
    tiempo_transito_dias: v.tiempoTransitoDias ?? null,
    frecuencia: v.frecuencia,
    ruta_texto: v.rutaTexto,
    validez_propuesta: v.validezPropuesta ? v.validezPropuesta.toISOString().split('T')[0] : null,
    tipo_movimiento: v.tipoMovimiento,
    seguro: v.seguro,
    valor_seguro_usd: v.seguro ? Number(v.valorSeguroUsd) || 0 : 0,
    num_contenedores: v.numContenedores,
    tipo_unidad: v.modo === 'Terrestre' ? v.tipoUnidad : null,
  };
}
