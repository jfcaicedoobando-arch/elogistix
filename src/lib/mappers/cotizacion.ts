import type { ConceptoVentaCotizacion, DimensionLCL, DimensionAerea } from '@/types/cotizacion';
import type { CotizacionFormValues } from '@/types/cotizacionForm';

/**
 * Construye el payload de datos generales (Paso 1) para crear/actualizar una cotización.
 * Función pura sin dependencias de React.
 */

interface PesoVolumen { peso: number; volumen: number; piezas: number }

function calcularPesoVolumenPiezas(v: CotizacionFormValues): PesoVolumen {
  if (v.modo === "Marítimo") {
    if (v.tipoEmbarque === "LCL") {
      return {
        peso: 0,
        volumen: v.dimensionesLCL.reduce((s, d) => s + d.volumen_m3, 0),
        piezas: v.dimensionesLCL.reduce((s, d) => s + d.piezas, 0),
      };
    }
    return { peso: 0, volumen: 0, piezas: 0 };
  }
  if (v.modo === "Aéreo") {
    return {
      peso: v.dimensionesAereas.reduce((s, d) => s + d.peso_volumetrico_kg, 0),
      volumen: 0,
      piezas: v.dimensionesAereas.reduce((s, d) => s + d.piezas, 0),
    };
  }
  return { peso: v.pesoKg, volumen: v.volumenM3, piezas: v.piezas };
}

function vigenciaDias(validez?: Date): number {
  if (!validez) return 15;
  return Math.max(1, Math.ceil((validez.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function partesCliente(v: CotizacionFormValues, clientes: { id: string; nombre: string }[]) {
  const cliente = clientes.find((c) => c.id === v.clienteId);
  return {
    es_prospecto: v.esProspecto,
    cliente_id: v.esProspecto ? null : v.clienteId,
    cliente_nombre: v.esProspecto ? v.prospectoEmpresa : (cliente?.nombre ?? ''),
    prospecto_empresa: v.esProspecto ? v.prospectoEmpresa : '',
    prospecto_contacto: v.esProspecto ? v.prospectoContacto : '',
    prospecto_email: v.esProspecto ? v.prospectoEmail : '',
    prospecto_telefono: v.esProspecto ? v.prospectoTelefono : '',
  };
}

function partesMercancia(v: CotizacionFormValues) {
  const esMaritimo = v.modo === "Marítimo";
  const esAereo = v.modo === "Aéreo";
  const esFcl = esMaritimo && v.tipoEmbarque === "FCL";
  const esLcl = esMaritimo && v.tipoEmbarque === "LCL";
  return {
    modo: v.modo,
    tipo: v.tipo,
    incoterm: v.incoterm,
    tipo_carga: v.tipoCarga,
    msds_archivo: null as string | null,
    tipo_embarque: esMaritimo ? v.tipoEmbarque : "FCL",
    tipo_contenedor: esFcl ? v.tipoContenedor : null,
    tipo_peso: esFcl ? v.tipoPeso : "Peso Normal",
    descripcion_mercancia: v.sectorEconomico,
    descripcion_adicional: v.descripcionAdicional,
    sector_economico: v.sectorEconomico,
    dimensiones_lcl: (esLcl ? v.dimensionesLCL : []) as DimensionLCL[],
    dimensiones_aereas: (esAereo ? v.dimensionesAereas : []) as DimensionAerea[],
    dias_libres_destino: esFcl ? v.diasLibresDestino : 0,
    dias_almacenaje: esLcl ? v.diasAlmacenaje : 0,
    carta_garantia: esFcl ? v.cartaGarantia : false,
    num_contenedores: v.numContenedores,
    tipo_unidad: v.modo === "Terrestre" ? v.tipoUnidad : null,
  };
}

function partesRuta(v: CotizacionFormValues) {
  return {
    origen: v.origen,
    destino: v.destino,
    tiempo_transito_dias: v.tiempoTransitoDias ?? null,
    frecuencia: v.frecuencia,
    ruta_texto: v.rutaTexto,
    validez_propuesta: v.validezPropuesta ? v.validezPropuesta.toISOString().split('T')[0] : null,
    tipo_movimiento: v.tipoMovimiento,
    seguro: v.seguro,
    valor_seguro_usd: v.seguro ? Number(v.valorSeguroUsd) || 0 : 0,
  };
}

export function buildPaso1Data(
  values: CotizacionFormValues,
  clientes: { id: string; nombre: string }[],
  userEmail: string,
): Record<string, unknown> {
  const { peso, volumen, piezas } = calcularPesoVolumenPiezas(values);
  return {
    ...partesCliente(values, clientes),
    ...partesMercancia(values),
    ...partesRuta(values),
    peso_kg: peso,
    volumen_m3: volumen,
    piezas,
    conceptos_venta: [] as ConceptoVentaCotizacion[],
    subtotal: 0,
    moneda: 'USD',
    vigencia_dias: vigenciaDias(values.validezPropuesta),
    notas: values.notas,
    operador: userEmail,
  };
}
