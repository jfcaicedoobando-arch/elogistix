import { pdf } from "@react-pdf/renderer";
import { writeFileSync } from "fs";
import React from "react";
import { CotizacionDocument } from "@/pdf/documents/CotizacionDocument";

const cotizacion: any = {
  id: "20b35611-f657-429f-b9d7-520a9d1a65b2",
  folio: "COT-2026-0076",
  cliente_id: "87bdcbf1-4476-43f5-a6a2-ac4991658f6e",
  cliente_nombre: "INDIMEX TRADING",
  es_prospecto: false,
  estado: "En operación",
  modo: "Marítimo",
  tipo: "Importación",
  tipo_embarque: "FCL",
  tipo_contenedor: "8014e97d-37a6-4e99-9238-fd507543c340",
  tipo_peso: "Peso Normal",
  tipo_movimiento: "CY-CY",
  tipo_carga: "Carga General",
  sector_economico: "General",
  descripcion_mercancia: "General",
  descripcion_adicional: "",
  incoterm: "FOB",
  origen: "Qingdao, China (CNQIN)",
  destino: "Ensenada, México (MXESE)",
  ruta_texto: "Qingdao → Ensenada",
  tiempo_transito_dias: 22,
  frecuencia: "",
  vigencia_dias: 15,
  fecha_vigencia: "2026-07-02",
  operador: "alan.hernandez@elogistixshipping.com",
  seguro: false,
  valor_seguro_usd: 0,
  peso_kg: 0, volumen_m3: 0, piezas: 0,
  num_contenedores: 1,
  dias_libres_destino: 21,
  dias_almacenaje: 0,
  carta_garantia: false,
  dimensiones_lcl: [],
  dimensiones_aereas: [],
  notas: null,
  comentario_cliente: null,
  created_at: "2026-06-17T21:38:50.331503+00:00",
  updated_at: "2026-06-18T01:02:57.904765+00:00",
  conceptos_venta: [
    { descripcion: "Flete marítimo (40' High Cube)", cantidad: 1, precio_unitario: 5790, total: 5790, moneda: "USD", aplica_iva: false, unidad_medida: "contenedor" },
  ],
  prospecto_empresa: "", prospecto_contacto: "", prospecto_email: "", prospecto_telefono: "",
};

const tiposContenedor = [
  { id: "8014e97d-37a6-4e99-9238-fd507543c340", code: "40HC", name: "40' High Cube", activo: true },
];

const emisor = {
  razonSocial: "Libre Carga",
  subtitulo: "Plataforma de Forwarders",
  rfc: "LCG230101AAA",
  direccion: "Av. Demo 123, CDMX",
  contacto: "hola@librecarga.com  ·  +52 55 1234 5678",
};

const blob = await pdf(React.createElement(CotizacionDocument, { cotizacion, tasaIva: 0.16, emisor, tiposContenedor }) as any).toBlob();
const buf = Buffer.from(await blob.arrayBuffer());
writeFileSync("/tmp/cot.pdf", buf);
console.log("OK", buf.length, "bytes");
