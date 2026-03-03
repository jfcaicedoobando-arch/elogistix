import type { TablesInsert } from '@/integrations/supabase/types';

const MODOS_VALIDOS = ['Marítimo', 'Aéreo', 'Terrestre', 'Multimodal'] as const;
const TIPOS_VALIDOS = ['Importación', 'Exportación', 'Nacional'] as const;
const INCOTERMS_VALIDOS = ['EXW', 'FOB', 'CIF', 'DAP', 'DDP', 'FCA', 'CFR', 'CPT', 'CIP', 'DAT'] as const;
const TIPOS_CARGA_VALIDOS = ['Carga General', 'Mercancía Peligrosa'] as const;
const TIPOS_SERVICIO_VALIDOS = ['FCL', 'LCL'] as const;

interface ColumnaCSV {
  encabezado: string;
  obligatorio: boolean;
  ejemplo: string;
  campo: string;
}

const COLUMNAS: ColumnaCSV[] = [
  { encabezado: 'Modo de Transporte', obligatorio: true, ejemplo: 'Marítimo', campo: 'modo' },
  { encabezado: 'Tipo de Operación', obligatorio: true, ejemplo: 'Importación', campo: 'tipo' },
  { encabezado: 'Cliente', obligatorio: true, ejemplo: 'Acme Corp', campo: 'cliente_nombre' },
  { encabezado: 'Incoterm', obligatorio: true, ejemplo: 'FOB', campo: 'incoterm' },
  { encabezado: 'Shipper', obligatorio: true, ejemplo: 'Shanghai Trading Co.', campo: 'shipper' },
  { encabezado: 'Consignatario', obligatorio: true, ejemplo: 'Acme México S.A.', campo: 'consignatario' },
  { encabezado: 'Descripción de Mercancía', obligatorio: true, ejemplo: 'Piezas automotrices', campo: 'descripcion_mercancia' },
  { encabezado: 'Tipo de Carga', obligatorio: true, ejemplo: 'Carga General', campo: 'tipo_carga' },
  { encabezado: 'ETD', obligatorio: true, ejemplo: '2026-04-15', campo: 'etd' },
  { encabezado: 'ETA', obligatorio: true, ejemplo: '2026-05-10', campo: 'eta' },
  { encabezado: 'Peso (kg)', obligatorio: false, ejemplo: '1500', campo: 'peso_kg' },
  { encabezado: 'Volumen (m³)', obligatorio: false, ejemplo: '12.5', campo: 'volumen_m3' },
  { encabezado: 'Piezas', obligatorio: false, ejemplo: '200', campo: 'piezas' },
  { encabezado: 'Puerto Origen', obligatorio: false, ejemplo: 'Shanghai, China', campo: 'puerto_origen' },
  { encabezado: 'Puerto Destino', obligatorio: false, ejemplo: 'Manzanillo, México', campo: 'puerto_destino' },
  { encabezado: 'Naviera', obligatorio: false, ejemplo: 'Maersk', campo: 'naviera' },
  { encabezado: 'Tipo Servicio', obligatorio: false, ejemplo: 'FCL', campo: 'tipo_servicio' },
  { encabezado: 'Contenedor', obligatorio: false, ejemplo: 'MSKU1234567', campo: 'contenedor' },
  { encabezado: 'Tipo Contenedor', obligatorio: false, ejemplo: "40' Dry Standard", campo: 'tipo_contenedor' },
  { encabezado: 'BL Master', obligatorio: false, ejemplo: 'MAEU123456789', campo: 'bl_master' },
  { encabezado: 'BL House', obligatorio: false, ejemplo: 'HBL-2026-001', campo: 'bl_house' },
  { encabezado: 'Aeropuerto Origen', obligatorio: false, ejemplo: '', campo: 'aeropuerto_origen' },
  { encabezado: 'Aeropuerto Destino', obligatorio: false, ejemplo: '', campo: 'aeropuerto_destino' },
  { encabezado: 'Aerolínea', obligatorio: false, ejemplo: '', campo: 'aerolinea' },
  { encabezado: 'MAWB', obligatorio: false, ejemplo: '', campo: 'mawb' },
  { encabezado: 'HAWB', obligatorio: false, ejemplo: '', campo: 'hawb' },
  { encabezado: 'Ciudad Origen', obligatorio: false, ejemplo: '', campo: 'ciudad_origen' },
  { encabezado: 'Ciudad Destino', obligatorio: false, ejemplo: '', campo: 'ciudad_destino' },
  { encabezado: 'Transportista', obligatorio: false, ejemplo: '', campo: 'transportista' },
  { encabezado: 'Carta Porte', obligatorio: false, ejemplo: '', campo: 'carta_porte' },
  { encabezado: 'Tipo Cambio USD', obligatorio: false, ejemplo: '17.25', campo: 'tipo_cambio_usd' },
  { encabezado: 'Tipo Cambio EUR', obligatorio: false, ejemplo: '18.50', campo: 'tipo_cambio_eur' },
];

function escaparCSV(valor: string): string {
  if (valor.includes(',') || valor.includes('"') || valor.includes('\n')) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

export function descargarPlantillaCSV() {
  const encabezados = COLUMNAS.map(c => c.obligatorio ? `${c.encabezado}*` : c.encabezado);
  const ejemplo = COLUMNAS.map(c => escaparCSV(c.ejemplo));

  const bom = '\uFEFF';
  const contenido = bom + encabezados.join(',') + '\n' + ejemplo.join(',') + '\n';

  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'plantilla_embarques.csv';
  enlace.click();
  URL.revokeObjectURL(url);
}

// --- Parser ---

function parsearLineaCSV(linea: string): string[] {
  const campos: string[] = [];
  let actual = '';
  let dentroComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const char = linea[i];
    if (dentroComillas) {
      if (char === '"' && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else if (char === '"') {
        dentroComillas = false;
      } else {
        actual += char;
      }
    } else {
      if (char === '"') {
        dentroComillas = true;
      } else if (char === ',') {
        campos.push(actual.trim());
        actual = '';
      } else {
        actual += char;
      }
    }
  }
  campos.push(actual.trim());
  return campos;
}

interface ClienteSelect { id: string; nombre: string }

export interface ErrorFila {
  fila: number;
  errores: string[];
}

export interface ResultadoParseo {
  validos: TablesInsert<'embarques'>[];
  errores: ErrorFila[];
}

function validarFecha(valor: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) && !isNaN(Date.parse(valor));
}

function validarNumerico(valor: string): boolean {
  return valor === '' || (!isNaN(Number(valor)) && valor.trim() !== '');
}

export function parsearCSVEmbarques(
  csvTexto: string,
  clientes: ClienteSelect[],
  operadorEmail: string,
): ResultadoParseo {
  const lineas = csvTexto.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());

  if (lineas.length < 2) {
    return { validos: [], errores: [{ fila: 1, errores: ['El archivo está vacío o solo tiene encabezados'] }] };
  }

  // Saltar encabezados (fila 0)
  const validos: TablesInsert<'embarques'>[] = [];
  const errores: ErrorFila[] = [];

  const clientesMap = new Map(clientes.map(c => [c.nombre.toLowerCase().trim(), c]));

  for (let i = 1; i < lineas.length; i++) {
    const campos = parsearLineaCSV(lineas[i]);
    if (campos.length < 10 || campos.every(c => c === '')) continue;

    const erroresFila: string[] = [];
    const obtenerCampo = (indice: number) => (indice < campos.length ? campos[indice] : '');

    const modo = obtenerCampo(0);
    const tipo = obtenerCampo(1);
    const clienteNombre = obtenerCampo(2);
    const incoterm = obtenerCampo(3);
    const shipper = obtenerCampo(4);
    const consignatario = obtenerCampo(5);
    const descripcion = obtenerCampo(6);
    const tipoCarga = obtenerCampo(7);
    const etd = obtenerCampo(8);
    const eta = obtenerCampo(9);
    const pesoKg = obtenerCampo(10);
    const volumenM3 = obtenerCampo(11);
    const piezas = obtenerCampo(12);

    // Validar obligatorios
    if (!modo) erroresFila.push('"Modo de Transporte*" es obligatorio');
    if (!tipo) erroresFila.push('"Tipo de Operación*" es obligatorio');
    if (!clienteNombre) erroresFila.push('"Cliente*" es obligatorio');
    if (!incoterm) erroresFila.push('"Incoterm*" es obligatorio');
    if (!shipper) erroresFila.push('"Shipper*" es obligatorio');
    if (!consignatario) erroresFila.push('"Consignatario*" es obligatorio');
    if (!descripcion) erroresFila.push('"Descripción de Mercancía*" es obligatorio');
    if (!tipoCarga) erroresFila.push('"Tipo de Carga*" es obligatorio');
    if (!etd) erroresFila.push('"ETD*" es obligatorio');
    if (!eta) erroresFila.push('"ETA*" es obligatorio');

    // Validar enums
    if (modo && !(MODOS_VALIDOS as readonly string[]).includes(modo)) {
      erroresFila.push(`Modo "${modo}" inválido. Valores: ${MODOS_VALIDOS.join(', ')}`);
    }
    if (tipo && !(TIPOS_VALIDOS as readonly string[]).includes(tipo)) {
      erroresFila.push(`Tipo de Operación "${tipo}" inválido. Valores: ${TIPOS_VALIDOS.join(', ')}`);
    }
    if (incoterm && !(INCOTERMS_VALIDOS as readonly string[]).includes(incoterm)) {
      erroresFila.push(`Incoterm "${incoterm}" inválido. Valores: ${INCOTERMS_VALIDOS.join(', ')}`);
    }
    if (tipoCarga && !(TIPOS_CARGA_VALIDOS as readonly string[]).includes(tipoCarga)) {
      erroresFila.push(`Tipo de Carga "${tipoCarga}" inválido. Valores: ${TIPOS_CARGA_VALIDOS.join(', ')}`);
    }

    const tipoServicio = obtenerCampo(16);
    if (tipoServicio && !(TIPOS_SERVICIO_VALIDOS as readonly string[]).includes(tipoServicio)) {
      erroresFila.push(`Tipo Servicio "${tipoServicio}" inválido. Valores: ${TIPOS_SERVICIO_VALIDOS.join(', ')}`);
    }

    // Validar cliente
    const clienteEncontrado = clienteNombre ? clientesMap.get(clienteNombre.toLowerCase().trim()) : undefined;
    if (clienteNombre && !clienteEncontrado) {
      erroresFila.push(`Cliente "${clienteNombre}" no encontrado en el sistema`);
    }

    // Validar fechas
    if (etd && !validarFecha(etd)) erroresFila.push(`ETD "${etd}" no es una fecha válida (YYYY-MM-DD)`);
    if (eta && !validarFecha(eta)) erroresFila.push(`ETA "${eta}" no es una fecha válida (YYYY-MM-DD)`);

    // Validar numéricos opcionales
    if (pesoKg && !validarNumerico(pesoKg)) erroresFila.push(`Peso "${pesoKg}" debe ser numérico`);
    if (volumenM3 && !validarNumerico(volumenM3)) erroresFila.push(`Volumen "${volumenM3}" debe ser numérico`);
    if (piezas && !validarNumerico(piezas)) erroresFila.push(`Piezas "${piezas}" debe ser numérico`);

    const tcUsd = obtenerCampo(30);
    const tcEur = obtenerCampo(31);
    if (tcUsd && !validarNumerico(tcUsd)) erroresFila.push(`Tipo Cambio USD "${tcUsd}" debe ser numérico`);
    if (tcEur && !validarNumerico(tcEur)) erroresFila.push(`Tipo Cambio EUR "${tcEur}" debe ser numérico`);

    if (erroresFila.length > 0) {
      errores.push({ fila: i + 1, errores: erroresFila });
      continue;
    }

    // Generar expediente único
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const secuencia = String(validos.length + Date.now() % 10000).padStart(4, '0');
    const expediente = `EXP-${anio}-${secuencia}`;

    validos.push({
      expediente,
      modo: modo as any,
      tipo: tipo as any,
      cliente_id: clienteEncontrado!.id,
      cliente_nombre: clienteEncontrado!.nombre,
      incoterm: incoterm as any,
      shipper,
      consignatario,
      descripcion_mercancia: descripcion,
      tipo_carga: tipoCarga,
      etd,
      eta,
      peso_kg: pesoKg ? Number(pesoKg) : 0,
      volumen_m3: volumenM3 ? Number(volumenM3) : 0,
      piezas: piezas ? Number(piezas) : 0,
      puerto_origen: obtenerCampo(13) || null,
      puerto_destino: obtenerCampo(14) || null,
      naviera: obtenerCampo(15) || null,
      tipo_servicio: (tipoServicio as any) || null,
      contenedor: obtenerCampo(17) || null,
      tipo_contenedor: obtenerCampo(18) || null,
      bl_master: obtenerCampo(19) || null,
      bl_house: obtenerCampo(20) || null,
      aeropuerto_origen: obtenerCampo(21) || null,
      aeropuerto_destino: obtenerCampo(22) || null,
      aerolinea: obtenerCampo(23) || null,
      mawb: obtenerCampo(24) || null,
      hawb: obtenerCampo(25) || null,
      ciudad_origen: obtenerCampo(26) || null,
      ciudad_destino: obtenerCampo(27) || null,
      transportista: obtenerCampo(28) || null,
      carta_porte: obtenerCampo(29) || null,
      tipo_cambio_usd: tcUsd ? Number(tcUsd) : 17.5,
      tipo_cambio_eur: tcEur ? Number(tcEur) : 19.0,
      operador: operadorEmail,
    });
  }

  return { validos, errores };
}
