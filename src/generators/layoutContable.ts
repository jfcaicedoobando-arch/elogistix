/**
 * Generador de "Layout contable" para el contador.
 *
 * Exporta facturas en un CSV plano con los campos que típicamente requiere
 * la póliza contable / pre-CFDI. No timbra ni genera XML CFDI 4.0.
 *
 * v8.205.0 — P0.4 auditoría: la hidratación de datos vive en
 * `services/facturas/exports.ts`. Este archivo es puramente presentación.
 */
import { exportToCsv } from "@/generators/exportCsv";
import { fetchLayoutContableData, type FacturaListItem } from "@/services/facturas";

const HEADERS = [
  { key: "folio", label: "Folio" },
  { key: "fecha_emision", label: "Fecha emisión" },
  { key: "periodo", label: "Periodo (YYYY-MM)" },
  { key: "tipo_comprobante", label: "Tipo comprobante" },
  { key: "rfc", label: "RFC receptor" },
  { key: "razon_social", label: "Razón social receptor" },
  { key: "subtotal", label: "Subtotal" },
  { key: "iva", label: "IVA trasladado" },
  { key: "total", label: "Total" },
  { key: "moneda", label: "Moneda" },
  { key: "tipo_cambio", label: "Tipo de cambio" },
  { key: "forma_pago", label: "Forma de pago" },
  { key: "metodo_pago", label: "Método de pago" },
  { key: "uso_cfdi", label: "Uso CFDI" },
  { key: "expediente", label: "Expediente" },
  { key: "referencia_bl", label: "Referencia BL" },
  { key: "estado", label: "Estado" },
];

/**
 * Descarga un layout contable CSV con los IDs de factura recibidos.
 */
export async function exportarLayoutContable(facturas: FacturaListItem[]): Promise<void> {
  if (facturas.length === 0) return;

  const { facturas: full, rfcByClienteId } = await fetchLayoutContableData(
    facturas.map((f) => f.id),
  );

  const csvRows = full.map((f) => {
    const subtotal = Number(f.subtotal ?? 0);
    const iva = Number(f.iva ?? 0);
    const total = Number(f.total ?? subtotal + iva);
    return {
      folio: f.numero,
      fecha_emision: f.fecha_emision,
      periodo: f.fecha_emision?.slice(0, 7) ?? "",
      tipo_comprobante: "I", // Ingreso
      rfc: f.cliente_id ? rfcByClienteId.get(f.cliente_id) ?? "" : "",
      razon_social: f.cliente_nombre ?? "",
      subtotal: subtotal.toFixed(2),
      iva: iva.toFixed(2),
      total: total.toFixed(2),
      moneda: f.moneda,
      tipo_cambio: Number(f.tipo_cambio ?? 1).toFixed(4),
      forma_pago: "", // a definir por el contador (01, 03, 04...)
      metodo_pago: "PUE", // default Pago en una exhibición
      uso_cfdi: "G03", // default Gastos en general
      expediente: f.expediente ?? "",
      referencia_bl: f.referencia_bl ?? "",
      estado: f.estado,
    };
  });

  exportToCsv(
    `layout_contable_${new Date().toISOString().slice(0, 10)}.csv`,
    HEADERS,
    csvRows,
  );
}
