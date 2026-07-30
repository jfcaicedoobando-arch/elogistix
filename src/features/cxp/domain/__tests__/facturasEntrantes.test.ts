import { describe, expect, it } from "vitest";
import {
  diasEnEspera,
  etiquetaEstadoEntrante,
  normalizarEstadoEntrante,
  puedeEliminarEntrante,
  puedeProcesarEntrante,
  resumirEntrantes,
  rutaArchivoEntrante,
  validarArchivoEntrante,
  varianteEstadoEntrante,
} from "@/features/cxp/domain/facturasEntrantes";

describe("facturasEntrantes · dominio", () => {
  it("normaliza estados desconocidos a por_capturar", () => {
    expect(normalizarEstadoEntrante("capturada")).toBe("capturada");
    expect(normalizarEstadoEntrante("otro")).toBe("por_capturar");
    expect(normalizarEstadoEntrante(null)).toBe("por_capturar");
  });

  it("expone etiquetas y variantes en es-MX", () => {
    expect(etiquetaEstadoEntrante("rechazada")).toBe("Rechazada");
    expect(varianteEstadoEntrante("capturada")).toBe("success");
    expect(varianteEstadoEntrante("por_capturar")).toBe("warning");
  });

  it("sólo permite procesar documentos pendientes", () => {
    expect(puedeProcesarEntrante("por_capturar")).toBe(true);
    expect(puedeProcesarEntrante("capturada")).toBe(false);
  });

  it("permite eliminar al autor o al admin mientras esté pendiente", () => {
    const base = { estado: "por_capturar", subidoPor: "u1", userId: "u1", isAdmin: false };
    expect(puedeEliminarEntrante(base)).toBe(true);
    expect(puedeEliminarEntrante({ ...base, userId: "u2" })).toBe(false);
    expect(puedeEliminarEntrante({ ...base, userId: "u2", isAdmin: true })).toBe(true);
    expect(puedeEliminarEntrante({ ...base, estado: "capturada", isAdmin: true })).toBe(false);
  });

  it("calcula días en espera sin negativos", () => {
    const ahora = new Date("2026-01-10T12:00:00Z");
    expect(diasEnEspera("2026-01-07T12:00:00Z", ahora)).toBe(3);
    expect(diasEnEspera("2026-01-10T11:00:00Z", ahora)).toBe(0);
    expect(diasEnEspera("2026-02-01T00:00:00Z", ahora)).toBe(0);
    expect(diasEnEspera("no-es-fecha", ahora)).toBe(0);
  });

  it("resume por estado", () => {
    const resumen = resumirEntrantes([
      { estado: "por_capturar" }, { estado: "por_capturar" },
      { estado: "capturada" }, { estado: "rechazada" },
    ]);
    expect(resumen).toEqual({ total: 4, porCapturar: 2, capturadas: 1, rechazadas: 1 });
  });

  it("valida extensión y tamaño del archivo", () => {
    expect(validarArchivoEntrante({ name: "invoice.pdf", size: 1000 })).toBeNull();
    expect(validarArchivoEntrante({ name: "cfdi.XML", size: 1000 })).toBeNull();
    expect(validarArchivoEntrante({ name: "foto.jpg", size: 1000 })).toMatch(/PDF o XML/);
    expect(validarArchivoEntrante({ name: "invoice.pdf", size: 20 * 1024 * 1024 })).toMatch(/límite/);
  });

  it("construye rutas seguras dentro de la carpeta de la organización", () => {
    const ruta = rutaArchivoEntrante({
      organizationId: "org-1",
      embarqueId: "emb-1",
      hash: "abcdef0123456789ffff",
      nombreArchivo: "Invoice #12 (final).pdf",
    });
    expect(ruta.startsWith("org-1/emb-1/abcdef0123456789-")).toBe(true);
    expect(ruta).not.toMatch(/[ #()]/);
  });
});
