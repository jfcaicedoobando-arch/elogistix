import { renderToFile } from "@react-pdf/renderer";
import { CotizacionDocument } from "@/pdf/documents/CotizacionDocument";
import { makeCotizacionRow } from "@/test/fixtures/cotizacionFactory";
const conceptos = Array.from({ length: 14 }, (_, i) => ({
  id: String(i), descripcion: `Concepto de venta número ${i + 1} con descripción larga para probar el salto`,
  unidad_medida: "contenedor", cantidad: 1, precio_unitario: 1200 + i, moneda: "USD",
  aplica_iva: i % 3 === 0, notas: i % 2 === 0 ? "Auto-cargado desde tarifa marítima" : null,
})) as never;
const cot = makeCotizacionRow({
  folio: "COT-2026-0236", cliente_nombre: "INDIMEX TRADING", origen: "Tianjin, China (CNTIA)",
  destino: "Manzanillo, México (MXZLO)", ruta_texto: "Tianjin → Manzanillo", conceptos_venta: conceptos,
});
await renderToFile(<CotizacionDocument cotizacion={cot} emisor={{ razonSocial: "Elogistix Shipping", subtitulo: "Agente de carga", rfc: "ESH2311092R7" }} />, "/tmp/pdfqa/out.pdf");
console.log("ok");
