/**
 * Generador de "Layout contable" para el contador.
 *
 * Exporta facturas en un CSV plano con los campos que típicamente requiere
 * la póliza contable / pre-CFDI:
 *   - Folio interno, fecha de emisión, periodo (YYYY-MM)
 *   - RFC y razón social del receptor (cliente)
 *   - Subtotal, IVA, Total, Moneda, Tipo de cambio
 *   - Expediente, BL de referencia, estado y forma/uso CFDI (placeholders)
 *
 * No timbra ni genera XML CFDI 4.0. Es un layout intermedio que el contador
 * puede importar a su sistema contable o usar como insumo del PAC.
 *
 * v8.190.0
 */
import { supabase } from "@/integrations/supabase/client";
import { exportToCsv } from "@/generators/exportCsv";
import type { FacturaListItem } from "@/services/facturas";

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

interface FacturaFull {
  numero: string;
  fecha_emision: string;
  subtotal: number | null;
  iva: number | null;
  total: number;
  moneda: string;
  tipo_cambio: number | null;
  expediente: string;
  referencia_bl: string | null;
  estado: string;
  cliente_id: string | null;
  cliente_nombre: string;
}

/**
 * Descarga un layout contable CSV con los IDs de factura recibidos.
 * Hace una sola consulta a `facturas` y otra a `clientes` para los RFC.
 */
export async function exportarLayoutContable(facturas: FacturaListItem[]): Promise<void> {
  if (facturas.length === 0) return;

  const ids = facturas.map((f) => f.id);
  const { data: rows, error } = await supabase
    .from("facturas")
    .select(
      "numero, fecha_emision, subtotal, iva, total, moneda, tipo_cambio, expediente, referencia_bl, estado, cliente_id, cliente_nombre",
    )
    .in("id", ids);
  if (error) throw error;

  const full = (rows ?? []) as FacturaFull[];
  const clienteIds = Array.from(new Set(full.map((r) => r.cliente_id).filter((x): x is string => !!x)));
  const rfcMap = new Map<string, string>();
  if (clienteIds.length > 0) {
    const { data: clientes, error: cErr } = await supabase
      .from("clientes")
      .select("id, rfc")
      .in("id", clienteIds);
    if (cErr) throw cErr;
    for (const c of clientes ?? []) {
      if (c.rfc) rfcMap.set(c.id, c.rfc);
    }
  }

  const csvRows = full.map((f) => {
    const subtotal = Number(f.subtotal ?? 0);
    const iva = Number(f.iva ?? 0);
    const total = Number(f.total ?? subtotal + iva);
    return {
      folio: f.numero,
      fecha_emision: f.fecha_emision,
      periodo: f.fecha_emision?.slice(0, 7) ?? "",
      tipo_comprobante: "I", // Ingreso
      rfc: f.cliente_id ? rfcMap.get(f.cliente_id) ?? "" : "",
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
