import { Cliente, Proveedor, Embarque, Factura, Shipper } from './types';

export const shippers: Shipper[] = [
  { id: 'S001', nombre: 'Bosch GmbH', pais: 'Alemania', ciudad: 'Stuttgart', direccion: 'Robert-Bosch-Platz 1, 70839 Gerlingen', contacto: 'Hans Mueller', email: 'exports@bosch.de', telefono: '+49 711 400 40990' },
  { id: 'S002', nombre: 'Zhejiang Textile Co. Ltd', pais: 'China', ciudad: 'Shanghai', direccion: '888 Pudong Ave, Pudong District', contacto: 'Wei Zhang', email: 'sales@zjtextile.cn', telefono: '+86 21 5888 6000' },
  { id: 'S003', nombre: 'Samsung Electronics', pais: 'Corea del Sur', ciudad: 'Incheon', direccion: '129 Samsung-ro, Yeongtong-gu, Suwon', contacto: 'Kim Soo-Jin', email: 'logistics@samsung.co.kr', telefono: '+82 31 200 1114' },
  { id: 'S004', nombre: 'Pfizer Inc.', pais: 'USA', ciudad: 'New York', direccion: '235 E 42nd St, New York, NY 10017', contacto: 'John Smith', email: 'shipping@pfizer.com', telefono: '+1 212 733 2323' },
  { id: 'S005', nombre: 'US Steel Corp', pais: 'USA', ciudad: 'Houston', direccion: '1 N Broadway, Houston, TX 77002', contacto: 'Robert Johnson', email: 'exports@ussteel.com', telefono: '+1 713 629 6000' },
  { id: 'S006', nombre: 'Procter & Gamble', pais: 'USA', ciudad: 'Cincinnati', direccion: '1 P&G Plaza, Cincinnati, OH 45202', contacto: 'Sarah Williams', email: 'logistics@pg.com', telefono: '+1 513 983 1100' },
  { id: 'S007', nombre: 'Alimentos del Valle S.A. de C.V.', pais: 'México', ciudad: 'Zapopan', direccion: 'Blvd. Puerta de Hierro 4965, Zapopan, Jalisco', contacto: 'Lic. María Fernanda López', email: 'exports@alivalle.com', telefono: '+52 33 3648 2000' },
  { id: 'S008', nombre: 'Mitsubishi Heavy Industries', pais: 'Japón', ciudad: 'Tokio', direccion: '2-3, Marunouchi 3-chome, Chiyoda-ku', contacto: 'Takeshi Yamamoto', email: 'export@mhi.co.jp', telefono: '+81 3 6275 6200' },
];

export const clientes: Cliente[] = [
  { id: 'C001', nombre: 'Grupo Industrial Saltillo S.A. de C.V.', rfc: 'GIS850101AB3', direccion: 'Av. Industria Automotriz 500', ciudad: 'Saltillo', estado: 'Coahuila', cp: '25070', contacto: 'Ing. Roberto Garza', email: 'rgarza@gis.com.mx', telefono: '+52 844 411 1000' },
  { id: 'C002', nombre: 'Alimentos del Valle S.A. de C.V.', rfc: 'AVA900315KL9', direccion: 'Blvd. Puerta de Hierro 4965', ciudad: 'Zapopan', estado: 'Jalisco', cp: '45116', contacto: 'Lic. María Fernanda López', email: 'mflopez@alivalle.com', telefono: '+52 33 3648 2000' },
  { id: 'C003', nombre: 'Electrónica Avanzada del Norte S. de R.L.', rfc: 'EAN070820QR5', direccion: 'Parque Industrial Apodaca Lote 12', ciudad: 'Apodaca', estado: 'Nuevo León', cp: '66600', contacto: 'Ing. Carlos Mendoza', email: 'cmendoza@ean.com.mx', telefono: '+52 81 8369 3000' },
  { id: 'C004', nombre: 'Textiles Modernos de Puebla S.A.', rfc: 'TMP950610JK2', direccion: 'Calle 5 de Mayo 2200', ciudad: 'Puebla', estado: 'Puebla', cp: '72000', contacto: 'Sra. Ana Patricia Ruiz', email: 'apruiz@texmod.com', telefono: '+52 222 246 1500' },
  { id: 'C005', nombre: 'Farmacéutica Nacional S.A. de C.V.', rfc: 'FNA880225MN8', direccion: 'Av. Revolución 1877', ciudad: 'Ciudad de México', estado: 'CDMX', cp: '01040', contacto: 'Dr. Alejandro Vega', email: 'avega@farmanac.com.mx', telefono: '+52 55 5550 3000' },
  { id: 'C006', nombre: 'Aceros y Metales del Bajío S.A.', rfc: 'AMB010430PQ1', direccion: 'Carretera León-Silao Km 8', ciudad: 'León', estado: 'Guanajuato', cp: '37530', contacto: 'Ing. Miguel Ángel Torres', email: 'matorres@acerosb.com', telefono: '+52 477 710 2000' },
  { id: 'C007', nombre: 'Distribuidora Comercial del Sureste S.A.', rfc: 'DCS960715RS4', direccion: 'Calle 60 No. 456', ciudad: 'Mérida', estado: 'Yucatán', cp: '97000', contacto: 'Lic. Gabriela Cámara', email: 'gcamara@discsur.com', telefono: '+52 999 920 4000' },
  { id: 'C008', nombre: 'Autopartes Premium de México S.A.', rfc: 'APM030912TU6', direccion: 'Av. de la Convención 302', ciudad: 'Aguascalientes', estado: 'Aguascalientes', cp: '20230', contacto: 'Ing. Fernando Rivas', email: 'frivas@autoprem.com.mx', telefono: '+52 449 994 1000' },
];

export const proveedores: Proveedor[] = [
  { id: 'P001', nombre: 'Maersk Line México', tipo: 'Naviera', rfc: 'MLM900101XX1', contacto: 'Juan Pérez', email: 'bookings@maersk.mx', telefono: '+52 55 5080 2000', monedaPreferida: 'USD' },
  { id: 'P002', nombre: 'MSC Mediterranean Shipping', tipo: 'Naviera', rfc: 'MSC850315YY2', contacto: 'Laura Sánchez', email: 'mexico@msc.com', telefono: '+52 55 5080 3000', monedaPreferida: 'USD' },
  { id: 'P003', nombre: 'DHL Global Forwarding', tipo: 'Aerolínea', rfc: 'DGF920620ZZ3', contacto: 'Pedro Martínez', email: 'airfreight@dhl.mx', telefono: '+52 55 5345 1000', monedaPreferida: 'USD' },
  { id: 'P004', nombre: 'Cargolux Airlines', tipo: 'Aerolínea', rfc: 'CAI880410WW4', contacto: 'Sofía Hernández', email: 'mexico@cargolux.com', telefono: '+52 55 5571 2000', monedaPreferida: 'EUR' },
  { id: 'P005', nombre: 'Transportes Castores', tipo: 'Transportista', rfc: 'TCA750101VV5', contacto: 'Ricardo López', email: 'operaciones@castores.com.mx', telefono: '+52 81 8158 1000', monedaPreferida: 'MXN' },
  { id: 'P006', nombre: 'Fletes y Maniobras del Pacífico', tipo: 'Transportista', rfc: 'FMP980305UU6', contacto: 'José García', email: 'fletes@fmpac.com', telefono: '+52 33 3837 1000', monedaPreferida: 'MXN' },
  { id: 'P007', nombre: 'TIF Transportes Internacionales', tipo: 'Transportista', rfc: 'TTI860715TT7', contacto: 'Mario Díaz', email: 'trafico@tifmx.com', telefono: '+52 55 5399 2000', monedaPreferida: 'MXN' },
  { id: 'P008', nombre: 'Agencia Aduanal Martínez & Asociados', tipo: 'Agente Aduanal', rfc: 'AAM700901SS8', contacto: 'Lic. Arturo Martínez', email: 'despachos@aamartinez.com', telefono: '+52 55 5260 1000', monedaPreferida: 'MXN' },
  { id: 'P009', nombre: 'Despacho Aduanero del Puerto', tipo: 'Agente Aduanal', rfc: 'DAP820215RR9', contacto: 'C.P. Elena Vargas', email: 'operaciones@dapuerto.com', telefono: '+52 314 332 1000', monedaPreferida: 'MXN' },
  { id: 'P010', nombre: 'Terminal Internacional de Manzanillo', tipo: 'Terminal', rfc: 'TIM950630QQ0', contacto: 'Ing. Pablo Nava', email: 'servicios@timsa.com.mx', telefono: '+52 314 331 2000', monedaPreferida: 'USD' },
];

export const embarques: Embarque[] = [
  {
    id: 'E001', expediente: 'EXP-2025-001', clienteId: 'C001', clienteNombre: 'Grupo Industrial Saltillo S.A. de C.V.', modo: 'Marítimo', tipo: 'Importación',
    shipper: 'Bosch GmbH - Stuttgart, Alemania', consignatario: 'Grupo Industrial Saltillo S.A. de C.V.',
    descripcionMercancia: 'Componentes automotrices - sensores y actuadores', pesoKg: 12500, volumenM3: 28, piezas: 450, incoterm: 'CIF',
    estado: 'En Tránsito', operador: 'Ana Rodríguez',
    puertoOrigen: 'Hamburgo, Alemania', puertoDestino: 'Manzanillo, México', naviera: 'Maersk Line', blMaster: 'MAEU123456789', blHouse: 'HLCU987654321',
    tipoServicio: 'FCL', contenedor: 'MSKU1234567', tipoContenedor: "40'HC",
    etd: '2025-02-10', eta: '2025-03-15', fechaCreacion: '2025-01-28',
    tipoCambioUSD: 17.25, tipoCambioEUR: 18.50,
    conceptosVenta: [
      { id: 'V001', descripcion: 'Flete marítimo Hamburgo-Manzanillo', cantidad: 1, precioUnitario: 2800, moneda: 'USD', total: 2800 },
      { id: 'V002', descripcion: 'THC destino', cantidad: 1, precioUnitario: 450, moneda: 'USD', total: 450 },
      { id: 'V003', descripcion: 'Servicio de agencia', cantidad: 1, precioUnitario: 4500, moneda: 'MXN', total: 4500 },
      { id: 'V004', descripcion: 'Maniobras en puerto', cantidad: 1, precioUnitario: 8500, moneda: 'MXN', total: 8500 },
    ],
    conceptosCosto: [
      { id: 'G001', proveedorId: 'P001', proveedorNombre: 'Maersk Line México', concepto: 'Flete marítimo', monto: 2400, moneda: 'USD', estadoLiquidacion: 'Pagado', fechaPago: '2025-02-08', referenciaPago: 'TRF-001', fechaVencimiento: '2025-02-15' },
      { id: 'G002', proveedorId: 'P010', proveedorNombre: 'Terminal Internacional de Manzanillo', concepto: 'THC + maniobras', monto: 380, moneda: 'USD', estadoLiquidacion: 'Pendiente', fechaVencimiento: '2025-03-20' },
      { id: 'G003', proveedorId: 'P009', proveedorNombre: 'Despacho Aduanero del Puerto', concepto: 'Honorarios despacho', monto: 6500, moneda: 'MXN', estadoLiquidacion: 'Pendiente', fechaVencimiento: '2025-03-25' },
    ],
    documentos: [
      { id: 'D001', nombre: 'Bill of Lading (BL)', estado: 'Validado' },
      { id: 'D002', nombre: 'Packing List', estado: 'Recibido' },
      { id: 'D003', nombre: 'Factura Comercial', estado: 'Validado' },
      { id: 'D004', nombre: 'Certificado de Origen', estado: 'Pendiente' },
    ],
    notas: [
      { id: 'N001', fecha: '2025-01-28', usuario: 'Ana Rodríguez', tipo: 'sistema', contenido: 'Embarque creado' },
      { id: 'N002', fecha: '2025-02-05', usuario: 'Ana Rodríguez', tipo: 'cambio_estado', contenido: 'Estado cambiado a Confirmado' },
      { id: 'N003', fecha: '2025-02-10', usuario: 'Ana Rodríguez', tipo: 'cambio_estado', contenido: 'Estado cambiado a En Tránsito' },
      { id: 'N004', fecha: '2025-02-12', usuario: 'Ana Rodríguez', tipo: 'nota', contenido: 'Cliente solicita aviso inmediato al arribo a Manzanillo' },
    ],
  },
  {
    id: 'E002', expediente: 'EXP-2025-002', clienteId: 'C002', clienteNombre: 'Alimentos del Valle S.A. de C.V.', modo: 'Marítimo', tipo: 'Exportación',
    shipper: 'Alimentos del Valle S.A. de C.V.', consignatario: 'Fresh Foods Distribution LLC - Los Angeles',
    descripcionMercancia: 'Aguacate Hass fresco - contenedor refrigerado', pesoKg: 22000, volumenM3: 58, piezas: 1100, incoterm: 'FOB',
    estado: 'Confirmado', operador: 'Carlos Mejía',
    puertoOrigen: 'Manzanillo, México', puertoDestino: 'Los Angeles, USA', naviera: 'MSC Mediterranean Shipping', blMaster: 'MSCU456789012', blHouse: 'MSCU-H-2025-002',
    tipoServicio: 'FCL', contenedor: 'MSCU7654321', tipoContenedor: "40'",
    etd: '2025-03-01', eta: '2025-03-08', fechaCreacion: '2025-02-10',
    tipoCambioUSD: 17.25, tipoCambioEUR: 18.50,
    conceptosVenta: [
      { id: 'V005', descripcion: 'Flete marítimo Manzanillo-LA', cantidad: 1, precioUnitario: 1800, moneda: 'USD', total: 1800 },
      { id: 'V006', descripcion: 'Servicio de agencia', cantidad: 1, precioUnitario: 3800, moneda: 'MXN', total: 3800 },
    ],
    conceptosCosto: [
      { id: 'G004', proveedorId: 'P002', proveedorNombre: 'MSC Mediterranean Shipping', concepto: 'Flete marítimo', monto: 1500, moneda: 'USD', estadoLiquidacion: 'Pendiente', fechaVencimiento: '2025-03-05' },
    ],
    documentos: [
      { id: 'D005', nombre: 'Bill of Lading (BL)', estado: 'Pendiente' },
      { id: 'D006', nombre: 'Packing List', estado: 'Recibido' },
      { id: 'D007', nombre: 'Factura Comercial', estado: 'Validado' },
      { id: 'D008', nombre: 'Certificado de Origen', estado: 'Recibido' },
    ],
    notas: [
      { id: 'N005', fecha: '2025-02-10', usuario: 'Carlos Mejía', tipo: 'sistema', contenido: 'Embarque creado' },
      { id: 'N006', fecha: '2025-02-20', usuario: 'Carlos Mejía', tipo: 'cambio_estado', contenido: 'Estado cambiado a Confirmado' },
    ],
  },
  {
    id: 'E003', expediente: 'EXP-2025-003', clienteId: 'C003', clienteNombre: 'Electrónica Avanzada del Norte S. de R.L.', modo: 'Aéreo', tipo: 'Importación',
    shipper: 'Samsung Electronics - Incheon, Corea del Sur', consignatario: 'Electrónica Avanzada del Norte S. de R.L.',
    descripcionMercancia: 'Circuitos integrados y componentes electrónicos', pesoKg: 850, volumenM3: 4.2, piezas: 120, incoterm: 'DAP',
    estado: 'En Tránsito', operador: 'Ana Rodríguez',
    aeropuertoOrigen: 'Incheon (ICN), Corea del Sur', aeropuertoDestino: 'AICM (MEX), Ciudad de México', aerolinea: 'DHL Global Forwarding', mawb: '172-12345678', hawb: 'DHL-H-2025-003',
    etd: '2025-02-22', eta: '2025-02-25', fechaCreacion: '2025-02-15',
    tipoCambioUSD: 17.25, tipoCambioEUR: 18.50,
    conceptosVenta: [
      { id: 'V007', descripcion: 'Flete aéreo ICN-MEX', cantidad: 850, precioUnitario: 4.50, moneda: 'USD', total: 3825 },
      { id: 'V008', descripcion: 'Gastos documentarios', cantidad: 1, precioUnitario: 2500, moneda: 'MXN', total: 2500 },
      { id: 'V009', descripcion: 'Servicio de agencia', cantidad: 1, precioUnitario: 5000, moneda: 'MXN', total: 5000 },
    ],
    conceptosCosto: [
      { id: 'G005', proveedorId: 'P003', proveedorNombre: 'DHL Global Forwarding', concepto: 'Flete aéreo', monto: 3200, moneda: 'USD', estadoLiquidacion: 'Pagado', fechaPago: '2025-02-20', referenciaPago: 'TRF-005', fechaVencimiento: '2025-02-20' },
      { id: 'G006', proveedorId: 'P008', proveedorNombre: 'Agencia Aduanal Martínez & Asociados', concepto: 'Despacho aduanal', monto: 8500, moneda: 'MXN', estadoLiquidacion: 'Pendiente', fechaVencimiento: '2025-03-05' },
    ],
    documentos: [
      { id: 'D009', nombre: 'Air Waybill (AWB)', estado: 'Validado' },
      { id: 'D010', nombre: 'Packing List', estado: 'Validado' },
      { id: 'D011', nombre: 'Factura Comercial', estado: 'Recibido' },
    ],
    notas: [
      { id: 'N007', fecha: '2025-02-15', usuario: 'Ana Rodríguez', tipo: 'sistema', contenido: 'Embarque creado' },
      { id: 'N008', fecha: '2025-02-22', usuario: 'Ana Rodríguez', tipo: 'cambio_estado', contenido: 'Carga despachada desde Incheon' },
    ],
  },
  {
    id: 'E004', expediente: 'EXP-2025-004', clienteId: 'C004', clienteNombre: 'Textiles Modernos de Puebla S.A.', modo: 'Marítimo', tipo: 'Importación',
    shipper: 'Zhejiang Textile Co. Ltd - Shanghai, China', consignatario: 'Textiles Modernos de Puebla S.A.',
    descripcionMercancia: 'Telas de poliéster y algodón', pesoKg: 18000, volumenM3: 45, piezas: 300, incoterm: 'FOB',
    estado: 'Llegada', operador: 'Luis Hernández',
    puertoOrigen: 'Shanghai, China', puertoDestino: 'Manzanillo, México', naviera: 'Maersk Line', blMaster: 'MAEU567890123', blHouse: 'HLCU-H-2025-004',
    tipoServicio: 'FCL', contenedor: 'MSKU9876543', tipoContenedor: "40'HC",
    etd: '2025-01-15', eta: '2025-02-20', fechaLlegadaReal: '2025-02-19', fechaCreacion: '2025-01-05',
    tipoCambioUSD: 17.20, tipoCambioEUR: 18.45,
    conceptosVenta: [
      { id: 'V010', descripcion: 'Flete marítimo Shanghai-Manzanillo', cantidad: 1, precioUnitario: 3200, moneda: 'USD', total: 3200 },
      { id: 'V011', descripcion: 'THC destino', cantidad: 1, precioUnitario: 450, moneda: 'USD', total: 450 },
      { id: 'V012', descripcion: 'Maniobras', cantidad: 1, precioUnitario: 9500, moneda: 'MXN', total: 9500 },
      { id: 'V013', descripcion: 'Servicio de agencia', cantidad: 1, precioUnitario: 4500, moneda: 'MXN', total: 4500 },
    ],
    conceptosCosto: [
      { id: 'G007', proveedorId: 'P001', proveedorNombre: 'Maersk Line México', concepto: 'Flete marítimo', monto: 2800, moneda: 'USD', estadoLiquidacion: 'Pagado', fechaPago: '2025-01-12', referenciaPago: 'TRF-007', fechaVencimiento: '2025-01-15' },
      { id: 'G008', proveedorId: 'P010', proveedorNombre: 'Terminal Internacional de Manzanillo', concepto: 'THC y almacenaje', monto: 420, moneda: 'USD', estadoLiquidacion: 'Pagado', fechaPago: '2025-02-22', referenciaPago: 'TRF-008', fechaVencimiento: '2025-02-25' },
    ],
    documentos: [
      { id: 'D012', nombre: 'Bill of Lading (BL)', estado: 'Validado' },
      { id: 'D013', nombre: 'Packing List', estado: 'Validado' },
      { id: 'D014', nombre: 'Factura Comercial', estado: 'Validado' },
      { id: 'D015', nombre: 'Certificado de Origen', estado: 'Validado' },
    ],
    notas: [
      { id: 'N009', fecha: '2025-01-05', usuario: 'Luis Hernández', tipo: 'sistema', contenido: 'Embarque creado' },
      { id: 'N010', fecha: '2025-02-19', usuario: 'Luis Hernández', tipo: 'cambio_estado', contenido: 'Buque arribó a Manzanillo - descarga programada' },
    ],
  },
  {
    id: 'E005', expediente: 'EXP-2025-005', clienteId: 'C005', clienteNombre: 'Farmacéutica Nacional S.A. de C.V.', modo: 'Aéreo', tipo: 'Importación',
    shipper: 'Pfizer Inc. - New York, USA', consignatario: 'Farmacéutica Nacional S.A. de C.V.',
    descripcionMercancia: 'Materia prima farmacéutica - temperatura controlada', pesoKg: 320, volumenM3: 2.1, piezas: 48, incoterm: 'CIF',
    estado: 'En Proceso', operador: 'Ana Rodríguez',
    aeropuertoOrigen: 'JFK, New York, USA', aeropuertoDestino: 'AICM (MEX), Ciudad de México', aerolinea: 'Cargolux Airlines', mawb: '172-98765432', hawb: 'CLX-H-2025-005',
    etd: '2025-02-18', eta: '2025-02-19', fechaLlegadaReal: '2025-02-19', fechaCreacion: '2025-02-12',
    tipoCambioUSD: 17.25, tipoCambioEUR: 18.50,
    conceptosVenta: [
      { id: 'V014', descripcion: 'Flete aéreo JFK-MEX', cantidad: 320, precioUnitario: 6.80, moneda: 'USD', total: 2176 },
      { id: 'V015', descripcion: 'Manejo especial temp. controlada', cantidad: 1, precioUnitario: 850, moneda: 'USD', total: 850 },
      { id: 'V016', descripcion: 'Servicio de agencia', cantidad: 1, precioUnitario: 6000, moneda: 'MXN', total: 6000 },
    ],
    conceptosCosto: [
      { id: 'G009', proveedorId: 'P004', proveedorNombre: 'Cargolux Airlines', concepto: 'Flete aéreo', monto: 1800, moneda: 'USD', estadoLiquidacion: 'Pagado', fechaPago: '2025-02-16', referenciaPago: 'TRF-009', fechaVencimiento: '2025-02-18' },
      { id: 'G010', proveedorId: 'P008', proveedorNombre: 'Agencia Aduanal Martínez & Asociados', concepto: 'Despacho farmacéutico', monto: 12000, moneda: 'MXN', estadoLiquidacion: 'Pendiente', fechaVencimiento: '2025-03-01' },
    ],
    documentos: [
      { id: 'D016', nombre: 'Air Waybill (AWB)', estado: 'Validado' },
      { id: 'D017', nombre: 'Packing List', estado: 'Validado' },
      { id: 'D018', nombre: 'Factura Comercial', estado: 'Validado' },
    ],
    notas: [
      { id: 'N011', fecha: '2025-02-12', usuario: 'Ana Rodríguez', tipo: 'sistema', contenido: 'Embarque creado - carga sensible' },
      { id: 'N012', fecha: '2025-02-19', usuario: 'Ana Rodríguez', tipo: 'nota', contenido: 'Carga en proceso de despacho aduanal - requiere permiso COFEPRIS' },
    ],
  },
  {
    id: 'E006', expediente: 'EXP-2025-006', clienteId: 'C006', clienteNombre: 'Aceros y Metales del Bajío S.A.', modo: 'Terrestre', tipo: 'Importación',
    shipper: 'US Steel Corp - Houston, TX', consignatario: 'Aceros y Metales del Bajío S.A.',
    descripcionMercancia: 'Bobinas de acero laminado en frío', pesoKg: 42000, volumenM3: 35, piezas: 12, incoterm: 'DAP',
    estado: 'En Tránsito', operador: 'Carlos Mejía',
    ciudadOrigen: 'Houston, TX, USA', ciudadDestino: 'León, Guanajuato', transportista: 'TIF Transportes Internacionales', cartaPorte: 'CP-2025-006-TIF',
    etd: '2025-02-23', eta: '2025-02-27', fechaCreacion: '2025-02-18',
    tipoCambioUSD: 17.25, tipoCambioEUR: 18.50,
    conceptosVenta: [
      { id: 'V017', descripcion: 'Flete terrestre Houston-León', cantidad: 1, precioUnitario: 2200, moneda: 'USD', total: 2200 },
      { id: 'V018', descripcion: 'Cruce fronterizo', cantidad: 1, precioUnitario: 450, moneda: 'USD', total: 450 },
      { id: 'V019', descripcion: 'Servicio de agencia', cantidad: 1, precioUnitario: 3500, moneda: 'MXN', total: 3500 },
    ],
    conceptosCosto: [
      { id: 'G011', proveedorId: 'P007', proveedorNombre: 'TIF Transportes Internacionales', concepto: 'Flete terrestre', monto: 1850, moneda: 'USD', estadoLiquidacion: 'Pendiente', fechaVencimiento: '2025-03-05' },
      { id: 'G012', proveedorId: 'P008', proveedorNombre: 'Agencia Aduanal Martínez & Asociados', concepto: 'Despacho aduanal Nuevo Laredo', monto: 7500, moneda: 'MXN', estadoLiquidacion: 'Pendiente', fechaVencimiento: '2025-03-10' },
    ],
    documentos: [
      { id: 'D019', nombre: 'Carta Porte', estado: 'Recibido' },
      { id: 'D020', nombre: 'Factura Comercial', estado: 'Validado' },
      { id: 'D021', nombre: 'Lista de Empaque', estado: 'Recibido' },
    ],
    notas: [
      { id: 'N013', fecha: '2025-02-18', usuario: 'Carlos Mejía', tipo: 'sistema', contenido: 'Embarque creado' },
      { id: 'N014', fecha: '2025-02-23', usuario: 'Carlos Mejía', tipo: 'cambio_estado', contenido: 'Carga salió de Houston' },
    ],
  },
  {
    id: 'E007', expediente: 'EXP-2025-007', clienteId: 'C007', clienteNombre: 'Distribuidora Comercial del Sureste S.A.', modo: 'Marítimo', tipo: 'Importación',
    shipper: 'Procter & Gamble - Cincinnati, USA', consignatario: 'Distribuidora Comercial del Sureste S.A.',
    descripcionMercancia: 'Productos de cuidado personal y limpieza', pesoKg: 15000, volumenM3: 52, piezas: 800, incoterm: 'CIF',
    estado: 'Cerrado', operador: 'Luis Hernández',
    puertoOrigen: 'Houston, USA', puertoDestino: 'Veracruz, México', naviera: 'MSC Mediterranean Shipping', blMaster: 'MSCU789012345', blHouse: 'MSCU-H-2025-007',
    tipoServicio: 'FCL', contenedor: 'MSCU1122334', tipoContenedor: "40'",
    etd: '2025-01-05', eta: '2025-01-12', fechaLlegadaReal: '2025-01-12', fechaCreacion: '2024-12-20',
    tipoCambioUSD: 17.15, tipoCambioEUR: 18.30,
    conceptosVenta: [
      { id: 'V020', descripcion: 'Flete marítimo Houston-Veracruz', cantidad: 1, precioUnitario: 1600, moneda: 'USD', total: 1600 },
      { id: 'V021', descripcion: 'THC y maniobras', cantidad: 1, precioUnitario: 12000, moneda: 'MXN', total: 12000 },
      { id: 'V022', descripcion: 'Servicio de agencia', cantidad: 1, precioUnitario: 4000, moneda: 'MXN', total: 4000 },
    ],
    conceptosCosto: [
      { id: 'G013', proveedorId: 'P002', proveedorNombre: 'MSC Mediterranean Shipping', concepto: 'Flete marítimo', monto: 1350, moneda: 'USD', estadoLiquidacion: 'Pagado', fechaPago: '2025-01-03', referenciaPago: 'TRF-013', fechaVencimiento: '2025-01-05' },
    ],
    documentos: [
      { id: 'D022', nombre: 'Bill of Lading (BL)', estado: 'Validado' },
      { id: 'D023', nombre: 'Packing List', estado: 'Validado' },
      { id: 'D024', nombre: 'Factura Comercial', estado: 'Validado' },
      { id: 'D025', nombre: 'Certificado de Origen', estado: 'Validado' },
    ],
    notas: [
      { id: 'N015', fecha: '2024-12-20', usuario: 'Luis Hernández', tipo: 'sistema', contenido: 'Embarque creado' },
      { id: 'N016', fecha: '2025-01-20', usuario: 'Luis Hernández', tipo: 'cambio_estado', contenido: 'Embarque cerrado - entrega completada' },
    ],
  },
  {
    id: 'E008', expediente: 'EXP-2025-008', clienteId: 'C008', clienteNombre: 'Autopartes Premium de México S.A.', modo: 'Terrestre', tipo: 'Importación',
    shipper: 'Detroit Auto Parts Inc. - Detroit, MI', consignatario: 'Autopartes Premium de México S.A.',
    descripcionMercancia: 'Transmisiones y partes de motor', pesoKg: 8500, volumenM3: 18, piezas: 65, incoterm: 'EXW',
    estado: 'Cotización', operador: 'Ana Rodríguez',
    ciudadOrigen: 'Detroit, MI, USA', ciudadDestino: 'Aguascalientes, México', transportista: 'Transportes Castores', cartaPorte: '',
    etd: '2025-03-10', eta: '2025-03-14', fechaCreacion: '2025-02-22',
    tipoCambioUSD: 17.25, tipoCambioEUR: 18.50,
    conceptosVenta: [
      { id: 'V023', descripcion: 'Flete terrestre Detroit-Aguascalientes', cantidad: 1, precioUnitario: 3500, moneda: 'USD', total: 3500 },
      { id: 'V024', descripcion: 'Servicio de agencia', cantidad: 1, precioUnitario: 4000, moneda: 'MXN', total: 4000 },
    ],
    conceptosCosto: [
      { id: 'G014', proveedorId: 'P005', proveedorNombre: 'Transportes Castores', concepto: 'Flete terrestre', monto: 52000, moneda: 'MXN', estadoLiquidacion: 'Pendiente', fechaVencimiento: '2025-03-15' },
    ],
    documentos: [
      { id: 'D026', nombre: 'Carta Porte', estado: 'Pendiente' },
      { id: 'D027', nombre: 'Factura Comercial', estado: 'Pendiente' },
      { id: 'D028', nombre: 'Lista de Empaque', estado: 'Pendiente' },
    ],
    notas: [
      { id: 'N017', fecha: '2025-02-22', usuario: 'Ana Rodríguez', tipo: 'sistema', contenido: 'Cotización creada para el cliente' },
    ],
  },
  {
    id: 'E009', expediente: 'EXP-2025-009', clienteId: 'C001', clienteNombre: 'Grupo Industrial Saltillo S.A. de C.V.', modo: 'Aéreo', tipo: 'Importación',
    shipper: 'Siemens AG - Munich, Alemania', consignatario: 'Grupo Industrial Saltillo S.A. de C.V.',
    descripcionMercancia: 'Controladores PLC y equipos de automatización', pesoKg: 280, volumenM3: 1.8, piezas: 35, incoterm: 'DAP',
    estado: 'Cerrado', operador: 'Carlos Mejía',
    aeropuertoOrigen: 'Munich (MUC), Alemania', aeropuertoDestino: 'Monterrey (MTY), México', aerolinea: 'DHL Global Forwarding', mawb: '172-55566677', hawb: 'DHL-H-2025-009',
    etd: '2025-01-20', eta: '2025-01-23', fechaLlegadaReal: '2025-01-23', fechaCreacion: '2025-01-10',
    tipoCambioUSD: 17.18, tipoCambioEUR: 18.40,
    conceptosVenta: [
      { id: 'V025', descripcion: 'Flete aéreo MUC-MTY', cantidad: 280, precioUnitario: 5.50, moneda: 'EUR', total: 1540 },
      { id: 'V026', descripcion: 'Servicio de agencia', cantidad: 1, precioUnitario: 5500, moneda: 'MXN', total: 5500 },
    ],
    conceptosCosto: [
      { id: 'G015', proveedorId: 'P003', proveedorNombre: 'DHL Global Forwarding', concepto: 'Flete aéreo', monto: 1200, moneda: 'EUR', estadoLiquidacion: 'Pagado', fechaPago: '2025-01-18', referenciaPago: 'TRF-015', fechaVencimiento: '2025-01-20' },
    ],
    documentos: [
      { id: 'D029', nombre: 'Air Waybill (AWB)', estado: 'Validado' },
      { id: 'D030', nombre: 'Packing List', estado: 'Validado' },
      { id: 'D031', nombre: 'Factura Comercial', estado: 'Validado' },
    ],
    notas: [],
  },
  {
    id: 'E010', expediente: 'EXP-2025-010', clienteId: 'C003', clienteNombre: 'Electrónica Avanzada del Norte S. de R.L.', modo: 'Marítimo', tipo: 'Importación',
    shipper: 'TSMC - Kaohsiung, Taiwán', consignatario: 'Electrónica Avanzada del Norte S. de R.L.',
    descripcionMercancia: 'Semiconductores y wafers de silicio', pesoKg: 5200, volumenM3: 12, piezas: 200, incoterm: 'CIF',
    estado: 'Confirmado', operador: 'Luis Hernández',
    puertoOrigen: 'Kaohsiung, Taiwán', puertoDestino: 'Manzanillo, México', naviera: 'Maersk Line', blMaster: 'MAEU111222333', blHouse: 'HLCU-H-2025-010',
    tipoServicio: 'LCL', contenedor: '', tipoContenedor: "20'",
    etd: '2025-03-05', eta: '2025-04-02', fechaCreacion: '2025-02-20',
    tipoCambioUSD: 17.25, tipoCambioEUR: 18.50,
    conceptosVenta: [
      { id: 'V027', descripcion: 'Flete marítimo LCL Kaohsiung-Manzanillo', cantidad: 12, precioUnitario: 85, moneda: 'USD', total: 1020 },
      { id: 'V028', descripcion: 'Servicio de agencia', cantidad: 1, precioUnitario: 4500, moneda: 'MXN', total: 4500 },
    ],
    conceptosCosto: [
      { id: 'G016', proveedorId: 'P001', proveedorNombre: 'Maersk Line México', concepto: 'Flete LCL', monto: 780, moneda: 'USD', estadoLiquidacion: 'Pendiente', fechaVencimiento: '2025-03-10' },
    ],
    documentos: [
      { id: 'D032', nombre: 'Bill of Lading (BL)', estado: 'Recibido' },
      { id: 'D033', nombre: 'Packing List', estado: 'Pendiente' },
      { id: 'D034', nombre: 'Factura Comercial', estado: 'Recibido' },
      { id: 'D035', nombre: 'Certificado de Origen', estado: 'Pendiente' },
    ],
    notas: [],
  },
  {
    id: 'E011', expediente: 'EXP-2025-011', clienteId: 'C005', clienteNombre: 'Farmacéutica Nacional S.A. de C.V.', modo: 'Aéreo', tipo: 'Exportación',
    shipper: 'Farmacéutica Nacional S.A. de C.V.', consignatario: 'Pharma Distributors LLC - Miami, FL',
    descripcionMercancia: 'Medicamentos genéricos - exportación', pesoKg: 1200, volumenM3: 6.5, piezas: 240, incoterm: 'FCA',
    estado: 'Cotización', operador: 'Carlos Mejía',
    aeropuertoOrigen: 'AICM (MEX), Ciudad de México', aeropuertoDestino: 'Miami (MIA), USA', aerolinea: 'Cargolux Airlines', mawb: '', hawb: '',
    etd: '2025-03-15', eta: '2025-03-16', fechaCreacion: '2025-02-24',
    tipoCambioUSD: 17.25, tipoCambioEUR: 18.50,
    conceptosVenta: [
      { id: 'V029', descripcion: 'Flete aéreo MEX-MIA', cantidad: 1200, precioUnitario: 3.20, moneda: 'USD', total: 3840 },
      { id: 'V030', descripcion: 'Servicio de agencia', cantidad: 1, precioUnitario: 5500, moneda: 'MXN', total: 5500 },
    ],
    conceptosCosto: [],
    documentos: [
      { id: 'D036', nombre: 'Air Waybill (AWB)', estado: 'Pendiente' },
      { id: 'D037', nombre: 'Packing List', estado: 'Pendiente' },
      { id: 'D038', nombre: 'Factura Comercial', estado: 'Pendiente' },
    ],
    notas: [],
  },
  {
    id: 'E012', expediente: 'EXP-2025-012', clienteId: 'C002', clienteNombre: 'Alimentos del Valle S.A. de C.V.', modo: 'Terrestre', tipo: 'Exportación',
    shipper: 'Alimentos del Valle S.A. de C.V.', consignatario: 'Whole Foods Market - Austin, TX',
    descripcionMercancia: 'Tequila y mezcal artesanal', pesoKg: 9800, volumenM3: 22, piezas: 650, incoterm: 'DAP',
    estado: 'En Tránsito', operador: 'Luis Hernández',
    ciudadOrigen: 'Guadalajara, Jalisco', ciudadDestino: 'Austin, TX, USA', transportista: 'Fletes y Maniobras del Pacífico', cartaPorte: 'CP-2025-012-FMP',
    etd: '2025-02-24', eta: '2025-02-28', fechaCreacion: '2025-02-15',
    tipoCambioUSD: 17.25, tipoCambioEUR: 18.50,
    conceptosVenta: [
      { id: 'V031', descripcion: 'Flete terrestre GDL-Austin', cantidad: 1, precioUnitario: 1800, moneda: 'USD', total: 1800 },
      { id: 'V032', descripcion: 'Servicio de agencia', cantidad: 1, precioUnitario: 3500, moneda: 'MXN', total: 3500 },
    ],
    conceptosCosto: [
      { id: 'G017', proveedorId: 'P006', proveedorNombre: 'Fletes y Maniobras del Pacífico', concepto: 'Flete terrestre', monto: 28000, moneda: 'MXN', estadoLiquidacion: 'Pendiente', fechaVencimiento: '2025-03-05' },
    ],
    documentos: [
      { id: 'D039', nombre: 'Carta Porte', estado: 'Validado' },
      { id: 'D040', nombre: 'Factura Comercial', estado: 'Validado' },
      { id: 'D041', nombre: 'Lista de Empaque', estado: 'Recibido' },
    ],
    notas: [],
  },
  {
    id: 'E013', expediente: 'EXP-2025-013', clienteId: 'C004', clienteNombre: 'Textiles Modernos de Puebla S.A.', modo: 'Marítimo', tipo: 'Importación',
    shipper: 'Guangzhou Fabrics Ltd - Shenzhen, China', consignatario: 'Textiles Modernos de Puebla S.A.',
    descripcionMercancia: 'Hilos industriales y fibras sintéticas', pesoKg: 25000, volumenM3: 60, piezas: 500, incoterm: 'FOB',
    estado: 'Cerrado', operador: 'Ana Rodríguez',
    puertoOrigen: 'Shenzhen, China', puertoDestino: 'Lázaro Cárdenas, México', naviera: 'MSC Mediterranean Shipping', blMaster: 'MSCU333444555', blHouse: 'MSCU-H-2025-013',
    tipoServicio: 'FCL', contenedor: 'MSCU5566778', tipoContenedor: "40'HC",
    etd: '2024-12-10', eta: '2025-01-15', fechaLlegadaReal: '2025-01-14', fechaCreacion: '2024-11-28',
    tipoCambioUSD: 17.10, tipoCambioEUR: 18.25,
    conceptosVenta: [
      { id: 'V033', descripcion: 'Flete marítimo Shenzhen-Lázaro Cárdenas', cantidad: 1, precioUnitario: 3500, moneda: 'USD', total: 3500 },
      { id: 'V034', descripcion: 'THC y maniobras', cantidad: 1, precioUnitario: 14000, moneda: 'MXN', total: 14000 },
      { id: 'V035', descripcion: 'Servicio de agencia', cantidad: 1, precioUnitario: 4500, moneda: 'MXN', total: 4500 },
    ],
    conceptosCosto: [
      { id: 'G018', proveedorId: 'P002', proveedorNombre: 'MSC Mediterranean Shipping', concepto: 'Flete marítimo', monto: 3000, moneda: 'USD', estadoLiquidacion: 'Pagado', fechaPago: '2024-12-08', referenciaPago: 'TRF-018', fechaVencimiento: '2024-12-10' },
    ],
    documentos: [
      { id: 'D042', nombre: 'Bill of Lading (BL)', estado: 'Validado' },
      { id: 'D043', nombre: 'Packing List', estado: 'Validado' },
      { id: 'D044', nombre: 'Factura Comercial', estado: 'Validado' },
      { id: 'D045', nombre: 'Certificado de Origen', estado: 'Validado' },
    ],
    notas: [],
  },
  {
    id: 'E014', expediente: 'EXP-2025-014', clienteId: 'C006', clienteNombre: 'Aceros y Metales del Bajío S.A.', modo: 'Marítimo', tipo: 'Importación',
    shipper: 'ArcelorMittal - Antwerp, Bélgica', consignatario: 'Aceros y Metales del Bajío S.A.',
    descripcionMercancia: 'Perfiles de acero estructural', pesoKg: 55000, volumenM3: 80, piezas: 25, incoterm: 'CFR',
    estado: 'Confirmado', operador: 'Ana Rodríguez',
    puertoOrigen: 'Amberes, Bélgica', puertoDestino: 'Veracruz, México', naviera: 'Maersk Line', blMaster: 'MAEU999888777', blHouse: 'HLCU-H-2025-014',
    tipoServicio: 'FCL', contenedor: 'MSKU8899001', tipoContenedor: "40'",
    etd: '2025-03-10', eta: '2025-04-05', fechaCreacion: '2025-02-25',
    tipoCambioUSD: 17.25, tipoCambioEUR: 18.50,
    conceptosVenta: [
      { id: 'V036', descripcion: 'Flete marítimo Amberes-Veracruz', cantidad: 1, precioUnitario: 4200, moneda: 'EUR', total: 4200 },
      { id: 'V037', descripcion: 'Servicio de agencia', cantidad: 1, precioUnitario: 5000, moneda: 'MXN', total: 5000 },
    ],
    conceptosCosto: [
      { id: 'G019', proveedorId: 'P001', proveedorNombre: 'Maersk Line México', concepto: 'Flete marítimo', monto: 3600, moneda: 'EUR', estadoLiquidacion: 'Pendiente', fechaVencimiento: '2025-03-15' },
    ],
    documentos: [
      { id: 'D046', nombre: 'Bill of Lading (BL)', estado: 'Pendiente' },
      { id: 'D047', nombre: 'Packing List', estado: 'Pendiente' },
      { id: 'D048', nombre: 'Factura Comercial', estado: 'Recibido' },
      { id: 'D049', nombre: 'Certificado de Origen', estado: 'Pendiente' },
    ],
    notas: [],
  },
  {
    id: 'E015', expediente: 'EXP-2025-015', clienteId: 'C008', clienteNombre: 'Autopartes Premium de México S.A.', modo: 'Terrestre', tipo: 'Nacional',
    shipper: 'Autopartes Premium de México S.A.', consignatario: 'Planta Nissan Aguascalientes',
    descripcionMercancia: 'Arneses eléctricos para ensamble automotriz', pesoKg: 3200, volumenM3: 8, piezas: 500, incoterm: 'DAP',
    estado: 'En Proceso', operador: 'Carlos Mejía',
    ciudadOrigen: 'Aguascalientes, México', ciudadDestino: 'Silao, Guanajuato', transportista: 'Transportes Castores', cartaPorte: 'CP-2025-015-TC',
    etd: '2025-02-25', eta: '2025-02-25', fechaLlegadaReal: '2025-02-25', fechaCreacion: '2025-02-23',
    tipoCambioUSD: 17.25, tipoCambioEUR: 18.50,
    conceptosVenta: [
      { id: 'V038', descripcion: 'Flete terrestre Ags-Silao', cantidad: 1, precioUnitario: 8500, moneda: 'MXN', total: 8500 },
      { id: 'V039', descripcion: 'Servicio de agencia', cantidad: 1, precioUnitario: 2000, moneda: 'MXN', total: 2000 },
    ],
    conceptosCosto: [
      { id: 'G020', proveedorId: 'P005', proveedorNombre: 'Transportes Castores', concepto: 'Flete terrestre', monto: 6500, moneda: 'MXN', estadoLiquidacion: 'Pendiente', fechaVencimiento: '2025-03-05' },
    ],
    documentos: [
      { id: 'D050', nombre: 'Carta Porte', estado: 'Validado' },
      { id: 'D051', nombre: 'Factura', estado: 'Validado' },
      { id: 'D052', nombre: 'Lista de Empaque', estado: 'Validado' },
    ],
    notas: [],
  },
];

export const facturas: Factura[] = [
  {
    id: 'F001', numero: 'FA-2025-001', embarqueId: 'E007', expediente: 'EXP-2025-007', clienteId: 'C007', clienteNombre: 'Distribuidora Comercial del Sureste S.A.',
    conceptos: embarques[6].conceptosVenta, subtotal: 43440, iva: 6950.40, total: 50390.40, moneda: 'MXN', tipoCambio: 17.15,
    fechaEmision: '2025-01-15', fechaVencimiento: '2025-02-14', estado: 'Pagada', referenciaBL: 'MSCU789012345',
  },
  {
    id: 'F002', numero: 'FA-2025-002', embarqueId: 'E013', expediente: 'EXP-2025-013', clienteId: 'C004', clienteNombre: 'Textiles Modernos de Puebla S.A.',
    conceptos: embarques[12].conceptosVenta, subtotal: 78350, iva: 12536, total: 90886, moneda: 'MXN', tipoCambio: 17.10,
    fechaEmision: '2025-01-20', fechaVencimiento: '2025-02-19', estado: 'Pagada', referenciaBL: 'MSCU333444555',
  },
  {
    id: 'F003', numero: 'FA-2025-003', embarqueId: 'E009', expediente: 'EXP-2025-009', clienteId: 'C001', clienteNombre: 'Grupo Industrial Saltillo S.A. de C.V.',
    conceptos: embarques[8].conceptosVenta, subtotal: 33836, iva: 5413.76, total: 39249.76, moneda: 'MXN', tipoCambio: 18.40,
    fechaEmision: '2025-01-28', fechaVencimiento: '2025-02-27', estado: 'Pagada', referenciaBL: '172-55566677',
  },
  {
    id: 'F004', numero: 'FA-2025-004', embarqueId: 'E004', expediente: 'EXP-2025-004', clienteId: 'C004', clienteNombre: 'Textiles Modernos de Puebla S.A.',
    conceptos: embarques[3].conceptosVenta, subtotal: 76830, iva: 12292.80, total: 89122.80, moneda: 'MXN', tipoCambio: 17.20,
    fechaEmision: '2025-02-22', fechaVencimiento: '2025-03-24', estado: 'Emitida', referenciaBL: 'MAEU567890123',
  },
  {
    id: 'F005', numero: 'FA-2025-005', embarqueId: 'E005', expediente: 'EXP-2025-005', clienteId: 'C005', clienteNombre: 'Farmacéutica Nacional S.A. de C.V.',
    conceptos: embarques[4].conceptosVenta, subtotal: 58198, iva: 9311.68, total: 67509.68, moneda: 'MXN', tipoCambio: 17.25,
    fechaEmision: '2025-02-20', fechaVencimiento: '2025-03-22', estado: 'Emitida', referenciaBL: '172-98765432',
  },
  {
    id: 'F006', numero: 'FA-2025-006', embarqueId: 'E001', expediente: 'EXP-2025-001', clienteId: 'C001', clienteNombre: 'Grupo Industrial Saltillo S.A. de C.V.',
    conceptos: embarques[0].conceptosVenta, subtotal: 69062.50, iva: 11050, total: 80112.50, moneda: 'MXN', tipoCambio: 17.25,
    fechaEmision: '2025-02-15', fechaVencimiento: '2025-03-17', estado: 'Borrador', referenciaBL: 'MAEU123456789',
  },
  {
    id: 'F007', numero: 'FA-2025-007', embarqueId: 'E002', expediente: 'EXP-2025-002', clienteId: 'C002', clienteNombre: 'Alimentos del Valle S.A. de C.V.',
    conceptos: embarques[1].conceptosVenta, subtotal: 34850, iva: 5576, total: 40426, moneda: 'MXN', tipoCambio: 17.25,
    fechaEmision: '2025-02-25', fechaVencimiento: '2025-03-27', estado: 'Borrador', referenciaBL: 'MSCU456789012',
  },
  {
    id: 'F008', numero: 'FA-2025-008', embarqueId: 'E003', expediente: 'EXP-2025-003', clienteId: 'C003', clienteNombre: 'Electrónica Avanzada del Norte S. de R.L.',
    conceptos: embarques[2].conceptosVenta, subtotal: 73481.25, iva: 11756.99, total: 85238.24, moneda: 'MXN', tipoCambio: 17.25,
    fechaEmision: '2025-02-24', fechaVencimiento: '2025-03-26', estado: 'Emitida', referenciaBL: '172-12345678',
  },
  {
    id: 'F009', numero: 'FA-2025-009', embarqueId: 'E012', expediente: 'EXP-2025-012', clienteId: 'C002', clienteNombre: 'Alimentos del Valle S.A. de C.V.',
    conceptos: embarques[11].conceptosVenta, subtotal: 34550, iva: 5528, total: 40078, moneda: 'MXN', tipoCambio: 17.25,
    fechaEmision: '2025-02-24', fechaVencimiento: '2025-03-26', estado: 'Vencida', referenciaBL: 'CP-2025-012-FMP',
  },
  {
    id: 'F010', numero: 'FA-2025-010', embarqueId: 'E015', expediente: 'EXP-2025-015', clienteId: 'C008', clienteNombre: 'Autopartes Premium de México S.A.',
    conceptos: embarques[14].conceptosVenta, subtotal: 10500, iva: 1680, total: 12180, moneda: 'MXN', tipoCambio: 17.25,
    fechaEmision: '2025-02-25', fechaVencimiento: '2025-03-27', estado: 'Cancelada', referenciaBL: 'CP-2025-015-TC',
  },
];

// Helper functions
export const formatCurrency = (amount: number, currency: string = 'MXN'): string => {
  const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency, minimumFractionDigits: 2 });
  return formatter.format(amount);
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

export const getEstadoColor = (estado: string): string => {
  const colors: Record<string, string> = {
    'Cotización': 'bg-muted text-muted-foreground',
    'Confirmado': 'bg-info/15 text-info',
    'En Tránsito': 'bg-warning/15 text-warning',
    'Llegada': 'bg-accent/15 text-accent',
    'En Proceso': 'bg-info/15 text-info',
    'Cerrado': 'bg-success/15 text-success',
    'Borrador': 'bg-muted text-muted-foreground',
    'Emitida': 'bg-info/15 text-info',
    'Pagada': 'bg-success/15 text-success',
    'Vencida': 'bg-destructive/15 text-destructive',
    'Cancelada': 'bg-destructive/15 text-destructive',
    'Pendiente': 'bg-warning/15 text-warning',
    'Recibido': 'bg-info/15 text-info',
    'Validado': 'bg-success/15 text-success',
    'Pagado': 'bg-success/15 text-success',
  };
  return colors[estado] || 'bg-muted text-muted-foreground';
};

export const getModoIcon = (modo: string): string => {
  const icons: Record<string, string> = {
    'Marítimo': '🚢',
    'Aéreo': '✈️',
    'Terrestre': '🚛',
    'Multimodal': '🔄',
  };
  return icons[modo] || '📦';
};
