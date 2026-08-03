/**
 * Extrae datos de una factura PDF con Gemini (Lovable AI Gateway) y mapea la
 * respuesta al shape que consume el frontend (`CfdiParsedResponse`).
 */

export interface Categoria { id: string; nombre: string }

export function parseCategoriasJson(raw: string | null): Categoria[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c: unknown) => typeof (c as Categoria)?.id === "string" && typeof (c as Categoria)?.nombre === "string")
      .slice(0, 200) as Categoria[];
  } catch {
    return [];
  }
}

const TOOL_DEF = {
  type: "function",
  function: {
    name: "extract_invoice",
    description: "Extrae los campos y conceptos de la factura del proveedor",
    parameters: {
      type: "object",
      properties: {
        invoice_number: { type: "string", description: "Folio o número de factura del proveedor" },
        issue_date: { type: "string", description: "Fecha de emisión en formato YYYY-MM-DD" },
        currency: { type: "string", description: "Código ISO 4217 (USD, EUR, MXN, CNY, etc.)" },
        exchange_rate_usd: { type: "number", description: "Tipo de cambio a USD si aparece, si no 0" },
        subtotal: { type: "number" },
        tax_total: { type: "number", description: "Total de IVA/VAT/GST/Sales Tax" },
        retention_total: { type: "number", description: "Total de retenciones si aplica, si no 0" },
        total: { type: "number", description: "Total de la factura" },
        supplier_name: { type: "string" },
        supplier_tax_id: { type: "string", description: "Tax ID/VAT/EIN/RFC del proveedor, si aparece" },
        customer_name: { type: "string" },
        customer_tax_id: { type: "string" },
        line_items: {
          type: "array",
          description: "Líneas/conceptos de la factura",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
              unit_price: { type: "number", description: "Precio UNITARIO de la línea (amount / quantity)" },
              amount: { type: "number", description: "Importe de la línea (cantidad * precio)" },
              tax: { type: "number" },
            },
            required: ["description", "amount"],
          },
        },
        categoria_id: { type: "string", description: "ID de la categoría contable que mejor matchea, o vacío" },
        notas: { type: "string", description: "Resumen breve (≤200 chars) de la factura" },
      },
      required: [
        "invoice_number", "issue_date", "currency", "subtotal", "tax_total",
        "total", "supplier_name", "line_items", "categoria_id", "notas",
      ],
    },
  },
};

const SYSTEM = `Eres un asistente contable que extrae datos de facturas de proveedores internacionales (inglés, chino, español, etc.). Devuelve SIEMPRE el resultado vía la función extract_invoice. Reglas:
- Fechas siempre YYYY-MM-DD. Si sólo hay mes/año, usa día 01.
- Moneda: código ISO 4217 (USD, EUR, MXN, CNY, JPY, etc.).
- Sólo devuelve exchange_rate_usd si aparece en el PDF; si no, 0.
- Los importes son números, no strings, sin comas de miles.
- No inventes conceptos: extrae exactamente las líneas de la factura.
- En cada línea devuelve SIEMPRE quantity y unit_price (precio UNITARIO) además de amount (total de la línea = quantity × unit_price). Si el PDF sólo muestra el total de la línea, calcula unit_price = amount / quantity.
- Si un campo no aparece, usa cadena vacía (string) o 0 (número).`;

interface GeminiCallParams {
  apiKey: string;
  pdfBase64: string;
  fileName: string;
  categorias: Categoria[];
}

export interface GeminiExtracted {
  invoice_number: string;
  issue_date: string;
  currency: string;
  exchange_rate_usd: number;
  subtotal: number;
  tax_total: number;
  retention_total: number;
  total: number;
  supplier_name: string;
  supplier_tax_id: string;
  customer_name: string;
  customer_tax_id: string;
  line_items: Array<{ description: string; quantity?: number; unit_price?: number; amount: number; tax?: number }>;
  categoria_id: string;
  notas: string;
}

export async function callGeminiExtract(p: GeminiCallParams): Promise<GeminiExtracted> {
  const catsBlock = p.categorias.length
    ? `\n\nCategorías contables disponibles (id | nombre):\n${p.categorias.slice(0, 100).map(c => `${c.id} | ${c.nombre}`).join("\n")}\n\nDevuelve el id que mejor matchea, o vacío si nada matchea claramente.`
    : "";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${p.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: `Extrae los campos y conceptos de esta factura de proveedor internacional.${catsBlock}` },
              {
                type: "file",
                file: {
                  filename: p.fileName || "invoice.pdf",
                  file_data: `data:application/pdf;base64,${p.pdfBase64}`,
                },
              },
            ],
          },
        ],
        tools: [TOOL_DEF],
        tool_choice: { type: "function", function: { name: "extract_invoice" } },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 402) {
        throw Object.assign(new Error("Sin créditos de IA disponibles. Añade créditos para procesar el PDF."), { status: 402 });
      }
      if (res.status === 429) {
        throw Object.assign(new Error("Demasiadas solicitudes a la IA. Espera unos segundos e intenta de nuevo."), { status: 429 });
      }
      throw Object.assign(new Error(`La IA respondió HTTP ${res.status}: ${body.slice(0, 300)}`), { status: 502 });
    }

    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      throw Object.assign(new Error("La IA no devolvió los campos extraídos"), { status: 502 });
    }
    const args = JSON.parse(call.function.arguments) as Partial<GeminiExtracted>;
    return normalize(args);
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalize(a: Partial<GeminiExtracted>): GeminiExtracted {
  return {
    invoice_number: String(a.invoice_number ?? "").trim(),
    issue_date: String(a.issue_date ?? "").slice(0, 10),
    currency: (String(a.currency ?? "USD").toUpperCase()).slice(0, 3),
    exchange_rate_usd: Number(a.exchange_rate_usd) || 0,
    subtotal: Number(a.subtotal) || 0,
    tax_total: Number(a.tax_total) || 0,
    retention_total: Number(a.retention_total) || 0,
    total: Number(a.total) || 0,
    supplier_name: String(a.supplier_name ?? "").trim(),
    supplier_tax_id: String(a.supplier_tax_id ?? "").trim(),
    customer_name: String(a.customer_name ?? "").trim(),
    customer_tax_id: String(a.customer_tax_id ?? "").trim(),
    line_items: Array.isArray(a.line_items) ? a.line_items.map((l) => ({
      description: String(l.description ?? "").slice(0, 500),
      quantity: Number(l.quantity) || undefined,
      unit_price: Number(l.unit_price) || undefined,
      amount: Number(l.amount) || 0,
      tax: Number(l.tax) || 0,
    })) : [],
    categoria_id: String(a.categoria_id ?? "").trim(),
    notas: String(a.notas ?? "").slice(0, 300),
  };
}

/**
 * Mapea el resultado de Gemini al shape `CfdiParsedResponse` que consume el
 * hook `useNuevaFacturaProveedorForm` en el frontend.
 */
export function mapGeminiToCfdiShape(d: GeminiExtracted, categorias: Categoria[]) {
  const monedaValida = ["MXN", "USD", "EUR"].includes(d.currency) ? d.currency : "USD";
  // Sólo dejamos categoria_id si la IA devolvió un id que existe en el catálogo.
  const catValida = d.categoria_id && categorias.some((c) => c.id === d.categoria_id)
    ? d.categoria_id
    : null;

  return {
    cfdi: {
      uuid: "",
      serie: "",
      folio: d.invoice_number,
      fecha: d.issue_date,
      moneda: monedaValida,
      tipo_cambio: d.exchange_rate_usd > 0 ? d.exchange_rate_usd : null,
      subtotal: d.subtotal,
      total: d.total,
      iva_trasladado: d.tax_total,
      ieps_trasladado: 0,
      retenciones: d.retention_total,
      emisor: {
        rfc: d.supplier_tax_id || "",
        nombre: d.supplier_name,
        regimen: "",
      },
      receptor: {
        rfc: d.customer_tax_id || "",
        nombre: d.customer_name,
      },
      // La IA devuelve `amount` como TOTAL de la línea, pero el sistema trata
      // `importe` como UNITARIO y lo multiplica por la cantidad. Sin normalizar,
      // una línea con cantidad > 1 se contaba dos veces (LC_CXP_DESCUADRE).
      conceptos: d.line_items.map((l) => {
        const cantidad = l.quantity && l.quantity > 0 ? l.quantity : 1;
        const unitario = l.unit_price && l.unit_price > 0
          ? l.unit_price
          : l.amount / cantidad;
        return {
          descripcion: l.description,
          cantidad,
          importe: Math.round(unitario * 1e6) / 1e6,
          iva: l.tax ?? 0,
          ieps: 0,
        };
      }),

    },
    ai: {
      categoria_id: catValida,
      notas: d.notas,
    },
  };
}
