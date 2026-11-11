import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  adjuntarArchivoCfdiFactura,
  quitarArchivoCfdiFactura,
  subirArchivosCfdiFactura,
  subirArchivosNcProveedor,
} from "../cfdiStorage";

const organizationId = "00000000-0000-0000-0000-000000000001";
const facturaId = "fac-123";
const ncId = "nc-123";
const xmlAnterior = `${organizationId}/cfdi/${facturaId}/xml-factura.xml`;
const notaXmlAnterior = `${organizationId}/nc/${ncId}/xml-factura.xml`;
const tablas = ["proveedor_facturas", "proveedor_notas_credito"] as const;
type Tabla = (typeof tablas)[number];
interface Fila {
  id: string;
  organization_id: string;
  deleted_at: string | null;
  archivo_xml_url: string | null;
  archivo_pdf_url: string | null;
}

const filas = new Map<Tabla, Fila>();
const objetos = new Map<string, string | File>();
const upload = vi.fn(async (path: string, file: File, opciones: { upsert: boolean }) => {
  if (objetos.has(path) && !opciones.upsert) return { error: new Error("Ruta ocupada") };
  objetos.set(path, file);
  return { error: null };
});
const remove = vi.fn(async (paths: string[]) => {
  paths.forEach((path) => objetos.delete(path));
  return { error: null };
});

function buscar(tabla: Tabla, filtros: Partial<Fila>) {
  const fila = filas.get(tabla);
  if (fila && Object.entries(filtros).every(([campo, valor]) => fila[campo as keyof Fila] === valor)) {
    return fila;
  }
  return null;
}

const leer = vi.fn(async (tabla: Tabla, filtros: Partial<Fila>) => {
  const fila = buscar(tabla, filtros);
  return { data: fila && { ...fila }, error: null };
});

function escribir(tabla: Tabla, filtros: Partial<Fila>, patch: Partial<Fila>) {
  const fila = buscar(tabla, filtros);
  if (!fila) return { data: null, error: null, status: 200 };
  Object.assign(fila, patch);
  return { data: { id: fila.id }, error: null, status: 200 };
}

const actualizar = vi.fn<
  (tabla: Tabla, filtros: Partial<Fila>, patch: Partial<Fila>) => Promise<{
    data: { id: string } | null;
    error: { code: string; message: string } | null;
    status: number;
  }>
>(async (...args) => escribir(...args));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ upload, remove }) },
    from: (tabla: Tabla) => {
      const filtros: Partial<Fila> = {};
      let patch: Partial<Fila> | undefined;
      const query = {
        eq<K extends keyof Fila>(campo: K, valor: Fila[K]) {
          filtros[campo] = valor;
          return query;
        },
        is<K extends keyof Fila>(campo: K, valor: Fila[K]) {
          return query.eq(campo, valor);
        },
        update(valores: Partial<Fila>) {
          patch = valores;
          return query;
        },
        select() {
          return query;
        },
        maybeSingle() {
          return patch ? actualizar(tabla, filtros, patch) : leer(tabla, filtros);
        },
      };
      return query;
    },
  },
}));

function xml() {
  return new File(["<cfdi:Comprobante/>"], "factura.xml", { type: "application/xml" });
}

function pdf() {
  return new File(["%PDF-1.4"], "factura.pdf", { type: "application/pdf" });
}

function reemplazar() {
  return adjuntarArchivoCfdiFactura({ facturaId, organizationId, tipo: "XML", file: xml() });
}

function conXmlAnterior(tabla: Tabla, path: string) {
  filas.get(tabla)!.archivo_xml_url = path;
  objetos.set(path, "archivo anterior");
}

const timeout = { data: null, error: { code: "", message: "timeout" }, status: 0 };

beforeEach(() => {
  vi.resetAllMocks();
  objetos.clear();
  tablas.forEach((tabla, index) => {
    filas.set(tabla, {
      id: index === 0 ? facturaId : ncId,
      organization_id: organizationId,
      deleted_at: null,
      archivo_xml_url: null,
      archivo_pdf_url: null,
    });
  });
});

describe("adjuntos CFDI", () => {
  it("conserva el prefijo de organización y asigna rutas independientes a XML y PDF", async () => {
    await subirArchivosCfdiFactura({ facturaId, organizationId, xmlFile: xml(), pdfFile: pdf() });
    const fila = filas.get("proveedor_facturas")!;
    expect(fila.archivo_xml_url).toMatch(new RegExp(`^${organizationId}/cfdi/${facturaId}/xml-.+-factura\\.xml$`));
    expect(fila.archivo_pdf_url).toMatch(new RegExp(`^${organizationId}/cfdi/${facturaId}/pdf-.+-factura\\.pdf$`));
    expect(objetos.has(fila.archivo_xml_url!)).toBe(true);
    expect(objetos.has(fila.archivo_pdf_url!)).toBe(true);
    expect(actualizar).toHaveBeenCalledWith("proveedor_facturas", {
      id: facturaId, organization_id: organizationId, deleted_at: null, archivo_xml_url: null, archivo_pdf_url: null,
    }, { archivo_xml_url: fila.archivo_xml_url, archivo_pdf_url: fila.archivo_pdf_url });
  });

  it("rechaza un PDF disfrazado de XML antes de subir", async () => {
    const xmlFile = new File(["%PDF-1.4"], "disfraz.xml", { type: "application/xml" });
    await expect(subirArchivosCfdiFactura({ facturaId, organizationId, xmlFile, pdfFile: null }))
      .rejects.toThrow(/no es un XML válido/);
    expect(upload).not.toHaveBeenCalled();
  });

  it("reemplaza un archivo del mismo nombre sin sobreescribirlo", async () => {
    conXmlAnterior("proveedor_facturas", xmlAnterior);
    const path = await reemplazar();

    expect(upload).toHaveBeenCalledWith(path, expect.any(File), { contentType: "application/xml", upsert: false });
    expect(path).not.toBe(xmlAnterior);
    expect(filas.get("proveedor_facturas")?.archivo_xml_url).toBe(path);
    expect(objetos.has(path)).toBe(true);
    expect(remove).toHaveBeenCalledWith([xmlAnterior]);
  });

  it("limpia únicamente el objeto nuevo si PostgreSQL rechaza la escritura", async () => {
    conXmlAnterior("proveedor_facturas", xmlAnterior);
    actualizar.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "rechazado" }, status: 403 });

    await expect(reemplazar()).rejects.toMatchObject({ message: "rechazado" });
    expect(filas.get("proveedor_facturas")?.archivo_xml_url).toBe(xmlAnterior);
    expect([...objetos.entries()]).toEqual([[xmlAnterior, "archivo anterior"]]);
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
  });

  it("rechaza un documento ausente antes de subir", async () => {
    filas.delete("proveedor_facturas");
    await expect(reemplazar()).rejects.toThrow(/no existe o fue eliminada/i);
    expect(upload).not.toHaveBeenCalled();
  });

  it("limpia el archivo nuevo si el documento se elimina después de la lectura", async () => {
    conXmlAnterior("proveedor_facturas", xmlAnterior);
    actualizar.mockImplementationOnce(async (tabla, filtros, patch) => {
      filas.get(tabla)!.deleted_at = "2026-11-10";
      return escribir(tabla, filtros, patch);
    });
    await expect(reemplazar()).rejects.toThrow(/cambiaron/);
    expect([...objetos.keys()]).toEqual([xmlAnterior]);
  });

  it("confirma un reemplazo que se aplicó antes de un timeout", async () => {
    conXmlAnterior("proveedor_facturas", xmlAnterior);
    actualizar.mockImplementationOnce(async (...args) => {
      escribir(...args);
      return timeout;
    });
    const path = await reemplazar();
    expect(leer).toHaveBeenCalledTimes(2);
    expect(filas.get("proveedor_facturas")?.archivo_xml_url).toBe(path);
    expect([...objetos.keys()]).toEqual([path]);
  });

  it("conserva el archivo nuevo si la escritura todavía puede aplicarse tras el timeout", async () => {
    conXmlAnterior("proveedor_facturas", xmlAnterior);
    actualizar.mockResolvedValueOnce(timeout);
    await expect(reemplazar()).rejects.toMatchObject({ message: "timeout" });

    // La primera lectura tras el timeout todavía veía el objeto anterior.
    escribir(...actualizar.mock.calls[0]);
    const path = filas.get("proveedor_facturas")?.archivo_xml_url;
    expect(path).toBe(upload.mock.calls[0][0]);
    expect(objetos.has(path!)).toBe(true);
    expect(remove).not.toHaveBeenCalled();
  });

  it.each(["detalle", "lote"] as const)("un reemplazo de detalle en paralelo con %s conserva un vínculo válido", async (otroEscritor) => {
    conXmlAnterior("proveedor_facturas", xmlAnterior);
    const primerUpload = upload.getMockImplementation()!;
    let soltarPrimero!: () => void;
    const segundoSubido = new Promise<void>((resolve) => { soltarPrimero = resolve; });
    upload.mockImplementationOnce(async (...args) => {
      const resultado = await primerUpload(...args);
      await segundoSubido;
      return resultado;
    });
    upload.mockImplementationOnce(async (...args) => {
      const resultado = await primerUpload(...args);
      soltarPrimero();
      return resultado;
    });

    const desdeDetalle = reemplazar();
    const segundoReemplazo = otroEscritor === "detalle"
      ? reemplazar()
      : subirArchivosCfdiFactura({ facturaId, organizationId, xmlFile: xml(), pdfFile: null });
    const resultados = await Promise.allSettled([desdeDetalle, segundoReemplazo]);
    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter((resultado) => resultado.status === "rejected")).toHaveLength(1);
    expect([...objetos.keys()]).toEqual([filas.get("proveedor_facturas")?.archivo_xml_url]);
  });

  it("mantiene el adjunto de la nota si falla la segunda subida", async () => {
    conXmlAnterior("proveedor_notas_credito", notaXmlAnterior);
    upload.mockImplementationOnce(upload.getMockImplementation()!)
      .mockResolvedValueOnce({ error: new Error("Falló la subida del PDF") });

    await expect(subirArchivosNcProveedor({ ncId, organizationId, xmlFile: xml(), pdfFile: pdf() }))
      .rejects.toThrow(/Falló la subida/);
    expect(filas.get("proveedor_notas_credito")?.archivo_xml_url).toBe(notaXmlAnterior);
    expect([...objetos.keys()]).toEqual([notaXmlAnterior]);
    expect(actualizar).not.toHaveBeenCalled();
  });

  it("quita un adjunto guardado como URL histórica", async () => {
    conXmlAnterior("proveedor_facturas", xmlAnterior);
    const url = `https://example.test/storage/v1/object/public/facturas/${xmlAnterior}`;
    filas.get("proveedor_facturas")!.archivo_xml_url = url;
    await quitarArchivoCfdiFactura({ facturaId, organizationId, path: url, tipo: "XML" });
    expect(filas.get("proveedor_facturas")?.archivo_xml_url).toBeNull();
    expect(remove).toHaveBeenCalledWith([xmlAnterior]);
  });

  it("rechaza una eliminación de un adjunto que fue reemplazado", async () => {
    conXmlAnterior("proveedor_facturas", xmlAnterior);
    const vigente = await reemplazar();
    await expect(quitarArchivoCfdiFactura({ facturaId, organizationId, path: xmlAnterior, tipo: "XML" }))
      .rejects.toThrow(/El adjunto cambió/);
    expect([...objetos.keys()]).toEqual([vigente]);
    expect(filas.get("proveedor_facturas")?.archivo_xml_url).toBe(vigente);
  });

  it("conserva el archivo histórico si el otro slot todavía lo referencia", async () => {
    conXmlAnterior("proveedor_facturas", xmlAnterior);
    filas.get("proveedor_facturas")!.archivo_pdf_url = xmlAnterior;
    await reemplazar();
    expect(filas.get("proveedor_facturas")?.archivo_pdf_url).toBe(xmlAnterior);
    expect(objetos.has(xmlAnterior)).toBe(true);
    expect(remove).not.toHaveBeenCalled();
  });
});
