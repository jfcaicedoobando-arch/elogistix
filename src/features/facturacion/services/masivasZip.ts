import { mapWithConcurrency } from "@/lib/async/mapWithConcurrency";
import { sanitizeFileName } from "@/lib/storage";
import { fetchCfdiFacturapi, esUrlFacturapi, type CfdiTipo } from "./descargarCfdiFacturapi";
import { fetchFacturasParaZip, type OpcionesFacturaMasiva } from "./masivas";

const TIPOS = ["pdf", "xml"] as const;

interface ResultadoFacturaZip {
  facturaId: string;
  numero: string | null;
  incluidos: CfdiTipo[];
  faltantes: CfdiTipo[];
}

async function obtenerBytes(stored: string | null, facturaId: string, tipo: CfdiTipo) {
  if (stored && !esUrlFacturapi(stored)) {
    const res = await fetch(stored);
    if (!res.ok) throw new Error("Documento no disponible");
    return res.arrayBuffer();
  }
  const { blob } = await fetchCfdiFacturapi({ tipo, facturaId });
  return blob.arrayBuffer();
}

function nombreDisponible(base: string, ocupados: Set<string>) {
  let nombre = base;
  let sufijo = 1;
  while (ocupados.has(nombre.toLowerCase())) {
    nombre = `${base}-${++sufijo}`;
  }
  ocupados.add(nombre.toLowerCase());
  return nombre;
}

export async function generarZipFacturas(
  ids: readonly string[],
  { scope, onProgress }: OpcionesFacturaMasiva,
): Promise<{ archivo: Blob | null; facturas: ResultadoFacturaZip[] }> {
  if (ids.length === 0) return { archivo: null, facturas: [] };
  const [filas, { default: JSZip }] = await Promise.all([
    fetchFacturasParaZip(ids, scope), import("jszip"),
  ]);
  scope.assertCurrent();
  const porId = new Map(filas.map((f) => [f.id, f]));
  const { ok } = await mapWithConcurrency(ids, 4, async (id) => {
    scope.assertCurrent();
    const f = porId.get(id);
    if (!f) return [];
    const respuestas = await Promise.allSettled(TIPOS.map((tipo) =>
      obtenerBytes(tipo === "pdf" ? f.factura_pdf_url : f.factura_xml_url, id, tipo)));
    return respuestas.flatMap((respuesta, i) => respuesta.status === "fulfilled" && respuesta.value.byteLength > 0
      ? [{ tipo: TIPOS[i], bytes: respuesta.value }]
      : []);
  }, onProgress);
  scope.assertCurrent();

  const zip = new JSZip();
  const descargados = new Map(ok.map(({ item, value }) => [item, value]));
  const ocupados = new Set<string>();
  const facturas = ids.map((facturaId): ResultadoFacturaZip => {
    const numero = porId.get(facturaId)?.numero ?? null;
    const documentos = descargados.get(facturaId) ?? [];
    const incluidos = documentos.map(({ tipo }) => tipo);
    if (documentos.length > 0) {
      const base = sanitizeFileName(numero ?? facturaId) || facturaId;
      const nombre = nombreDisponible(base, ocupados);
      for (const { tipo, bytes } of documentos) zip.file(`facturas/${nombre}.${tipo}`, bytes);
    }
    return { facturaId, numero, incluidos, faltantes: TIPOS.filter((tipo) => !incluidos.includes(tipo)) };
  });
  if (!facturas.some(({ incluidos }) => incluidos.length > 0)) return { archivo: null, facturas };
  const archivo = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  scope.assertCurrent();
  return { archivo, facturas };
}
