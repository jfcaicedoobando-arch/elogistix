import { renderToFile } from "@react-pdf/renderer";
import { ProformaDocument } from "../src/pdf/documents/ProformaDocument";

const proforma = {
  numero: "PRO-2026-1044", fecha_emision: "2026-09-03", expediente: "ELIMP00399",
  cliente_nombre: "INDIMEX TRADING", operador: "valeria.zamora@elogistixshipping.com",
  dias_credito: 30, bl_master: null, notas: null,
  subtotal_usd: 3020, iva_usd: 52, total_usd: 3072,
  subtotal_mxn: 0, iva_mxn: 0, total_mxn: 0,
} as never;
const embarque = {
  expediente: "ELIMP00399", bl_house: null, modo: "Aéreo", tipo: "Importación", incoterm: "EXW",
  aeropuerto_origen: "SHANGHAI", aeropuerto_destino: "GUADALAJARA",
  puerto_origen: null, puerto_destino: null, ciudad_origen: null, ciudad_destino: null,
  naviera: null, aerolinea: null, descripcion_mercancia: "CAJAS", contenedores: [],
} as never;
const c = (descripcion: string, precio: number, iva: boolean) => ({
  descripcion, moneda: "USD", cantidad: 1, precio_unitario: precio, subtotal: precio, aplica_iva: iva,
}) as never;
const cliente = { nombre: "INDIMEX TRADING", rfc: "ITR180123SP4", direccion: "CALLE DEL COMERCIO 4 PISO 6 SANTA ENGRACIA", ciudad: "SAN PEDRO GARZA GARCIA", estado: "NUEVO LEON", cp: "66267" } as never;

await renderToFile(
  <ProformaDocument
    proforma={proforma}
    embarque={embarque}
    conceptos={[c("Cargos Origen", 580, false), c("Cargos Destino", 325, true), c("Flete Aereo", 2115, false)]}
    cliente={cliente}
    emisor={{ razonSocial: "Elogistix Shipping", subtitulo: "Agente de Carga", rfc: "ESH2311092R7" }}
  />,
  "/tmp/pdfqa/out.pdf",
);
console.log("ok");
