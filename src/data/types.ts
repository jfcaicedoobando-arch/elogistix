export type ModoTransporte = 'Marítimo' | 'Aéreo' | 'Terrestre' | 'Multimodal';
export type TipoOperacion = 'Importación' | 'Exportación' | 'Nacional';
export type EstadoEmbarque = 'Cotización' | 'Confirmado' | 'En Tránsito' | 'Llegada' | 'En Proceso' | 'Cerrado';
export type EstadoDocumento = 'Pendiente' | 'Recibido' | 'Validado';
export type EstadoFactura = 'Borrador' | 'Emitida' | 'Pagada' | 'Vencida' | 'Cancelada';
export type EstadoLiquidacion = 'Pendiente' | 'Pagado';
export type Moneda = 'MXN' | 'USD' | 'EUR';
export type TipoProveedor = 'Naviera' | 'Aerolínea' | 'Transportista' | 'Agente Aduanal' | 'Terminal';
export type TipoContenedor = "20'" | "40'" | "40'HC";
export type TipoServicioMaritimo = 'FCL' | 'LCL';
export type Incoterm = 'EXW' | 'FOB' | 'CIF' | 'DAP' | 'DDP' | 'FCA' | 'CFR' | 'CPT' | 'CIP' | 'DAT';

export interface Cliente {
  id: string;
  nombre: string;
  rfc: string;
  direccion: string;
  ciudad: string;
  estado: string;
  cp: string;
  contacto: string;
  email: string;
  telefono: string;
}

export interface Shipper {
  id: string;
  nombre: string;
  pais: string;
  ciudad: string;
  direccion: string;
  contacto: string;
  email: string;
  telefono: string;
  notas?: string;
}

export interface Proveedor {
  id: string;
  nombre: string;
  tipo: TipoProveedor;
  rfc: string;
  contacto: string;
  email: string;
  telefono: string;
  monedaPreferida: Moneda;
}

export interface DocumentoEmbarque {
  id: string;
  nombre: string;
  estado: EstadoDocumento;
  archivo?: string;
  notas?: string;
}

export interface ConceptoVenta {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  moneda: Moneda;
  total: number;
}

export interface ConceptoCosto {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  concepto: string;
  monto: number;
  moneda: Moneda;
  estadoLiquidacion: EstadoLiquidacion;
  fechaPago?: string;
  referenciaPago?: string;
  fechaVencimiento?: string;
}

export interface NotaActividad {
  id: string;
  fecha: string;
  usuario: string;
  tipo: 'nota' | 'cambio_estado' | 'documento' | 'factura' | 'sistema';
  contenido: string;
}

export interface Embarque {
  id: string;
  expediente: string;
  clienteId: string;
  clienteNombre: string;
  modo: ModoTransporte;
  tipo: TipoOperacion;
  shipper: string;
  consignatario: string;
  descripcionMercancia: string;
  pesoKg: number;
  volumenM3: number;
  piezas: number;
  incoterm: Incoterm;
  estado: EstadoEmbarque;
  operador: string;
  // Ruta marítima
  puertoOrigen?: string;
  puertoDestino?: string;
  naviera?: string;
  blMaster?: string;
  blHouse?: string;
  tipoServicio?: TipoServicioMaritimo;
  contenedor?: string;
  tipoContenedor?: TipoContenedor;
  // Ruta aérea
  aeropuertoOrigen?: string;
  aeropuertoDestino?: string;
  aerolinea?: string;
  mawb?: string;
  hawb?: string;
  // Ruta terrestre
  ciudadOrigen?: string;
  ciudadDestino?: string;
  transportista?: string;
  cartaPorte?: string;
  // Fechas
  etd: string;
  eta: string;
  fechaLlegadaReal?: string;
  fechaCreacion: string;
  // Financiero
  conceptosVenta: ConceptoVenta[];
  conceptosCosto: ConceptoCosto[];
  documentos: DocumentoEmbarque[];
  notas: NotaActividad[];
  tipoCambioUSD: number;
  tipoCambioEUR: number;
}

export interface Factura {
  id: string;
  numero: string;
  embarqueId: string;
  expediente: string;
  clienteId: string;
  clienteNombre: string;
  conceptos: ConceptoVenta[];
  subtotal: number;
  iva: number;
  total: number;
  moneda: Moneda;
  tipoCambio: number;
  fechaEmision: string;
  fechaVencimiento: string;
  estado: EstadoFactura;
  referenciaBL?: string;
  notas?: string;
}
