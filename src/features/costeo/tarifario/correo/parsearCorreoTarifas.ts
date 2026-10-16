/**
 * Despachador del extractor de tarifas por correo: según el proveedor elige
 * el parser (texto plano o Excel) y devuelve filas crudas con los encabezados
 * de la importación CSV/Excel, listas para `prepararImportacion`.
 */
import { parsearOriental } from "./parsearOriental";
import { parsearGolden } from "./parsearGolden";
import { parsearLongsail } from "./parsearLongsail";
import { parsearRainbow } from "./parsearRainbow";
import { anioDelCorreo, type FilaCorreo } from "./comun";
import { NOMBRE_PROVEEDOR, type ProveedorCorreo } from "./proveedoresCorreo";

export interface CorreoDescargado {
  proveedor: string;
  asunto: string;
  fecha: string;
  textoPlano: string;
  xlsxBase64: string | null;
  xlsxNombre: string | null;
  error?: string;
}

export interface ResultadoCorreo {
  filas: FilaCorreo[];
  errores: string[];
}

const esProveedor = (v: string): v is ProveedorCorreo => v in NOMBRE_PROVEEDOR;

/** Lee la hoja CHINA del Excel de Rainbow como arreglo de renglones. */
async function leerHojaChina(xlsxBase64: string): Promise<unknown[][]> {
  const XLSX = await import("xlsx");
  const bin = atob(xlsxBase64.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const wb = XLSX.read(bytes, { type: "array", cellDates: true });
  const hoja = wb.Sheets["CHINA"] ?? wb.Sheets[wb.SheetNames[0]];
  return hoja ? XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: "" }) : [];
}

export async function parsearCorreoProveedor(correo: CorreoDescargado, hoyIso: string): Promise<ResultadoCorreo> {
  const nombre = NOMBRE_PROVEEDOR[correo.proveedor as ProveedorCorreo] ?? correo.proveedor;
  if (correo.error) return { filas: [], errores: [`${nombre}: ${correo.error}`] };
  if (!esProveedor(correo.proveedor)) return { filas: [], errores: [`Proveedor «${correo.proveedor}» sin parser`] };
  const anio = anioDelCorreo(correo.fecha);

  switch (correo.proveedor) {
    case "oriental":
      return parsearOriental(correo.textoPlano, anio, hoyIso);
    case "golden":
      return parsearGolden(correo.textoPlano, anio, hoyIso);
    case "longsail":
      return parsearLongsail(correo.textoPlano, anio, hoyIso);
    case "rainbow": {
      if (!correo.xlsxBase64) return { filas: [], errores: ["Rainbow: el correo no trae el Excel de tarifas"] };
      try {
        return parsearRainbow(await leerHojaChina(correo.xlsxBase64), hoyIso);
      } catch (e) {
        return { filas: [], errores: [`Rainbow: no se pudo leer el Excel (${e instanceof Error ? e.message : String(e)})`] };
      }
    }
  }
}
