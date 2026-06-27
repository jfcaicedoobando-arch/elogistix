import { describe, it, expect } from "vitest";
import { describirEntrada, GRUPOS_ACCION } from "@/lib/domain/bitacoraDescripcion";
import type { EntradaBitacora } from "@/types/bitacora";

// ─── Helper ───────────────────────────────────────────────────────────────────
const entrada = (
  accion: string,
  modulo: string,
  detalles: Record<string, unknown> = {},
): EntradaBitacora => ({
  id: "1",
  usuario_id: "u1",
  usuario_email: "user@test.com",
  accion,
  modulo,
  entidad_id: null,
  entidad_nombre: "",
  detalles,
  created_at: new Date().toISOString(),
});

describe("bitacoraDescripcion.extra", () => {
  it("describirEntrada: login genera título fijo", () => {
    const r = describirEntrada(entrada("login", "auth"));
    expect(r.titulo).toBe("Inició sesión");
  });

  it("describirEntrada: cambiar_estado con anterior y nuevo", () => {
    const r = describirEntrada(entrada("cambiar_estado", "embarques", {
      estado_anterior: "borrador",
      estado_nuevo: "activo",
    }));
    expect(r.titulo).toBe("Cambió estado de borrador a activo");
    expect(r.estadoAnterior).toBe("borrador");
    expect(r.estadoNuevo).toBe("activo");
  });

  it("describirEntrada: cambio_estado sin estado_anterior", () => {
    const r = describirEntrada(entrada("cambio_estado", "embarques", {
      estado_nuevo: "completado",
    }));
    expect(r.titulo).toBe("Cambió estado a completado");
    expect(r.estadoNuevo).toBe("completado");
    expect(r.estadoAnterior).toBeUndefined();
  });

  it("describirEntrada: cambio_estado sin detalles retorna genérico", () => {
    const r = describirEntrada(entrada("cambiar_estado", "embarques", {}));
    expect(r.titulo).toBe("Cambió estado");
  });

  it("describirEntrada: subir_documento con tipo_documento", () => {
    const r = describirEntrada(entrada("subir_documento", "embarques", { tipo_documento: "BL" }));
    expect(r.titulo).toBe("Subió BL");
  });

  it("describirEntrada: eliminar_documento usa campo nombre como fallback", () => {
    const r = describirEntrada(entrada("eliminar_documento", "embarques", { nombre: "Factura.pdf" }));
    expect(r.titulo).toBe("Eliminó Factura.pdf");
  });

  it("describirEntrada: agregar_nota sin contenido", () => {
    const r = describirEntrada(entrada("agregar_nota", "embarques", {}));
    expect(r.titulo).toBe("Agregó una nota");
    expect(r.contexto).toBeUndefined();
  });

  it("describirEntrada: agregar_nota con contenido largo genera preview ≤80 chars", () => {
    const larga = "x".repeat(120);
    const r = describirEntrada(entrada("agregar_nota", "embarques", { contenido: larga }));
    expect(r.contexto?.length).toBeLessThanOrEqual(82); // 80 + "…"
    expect(r.contexto?.endsWith("…")).toBe(true);
  });

  it("describirEntrada: factura con folio y monto MXN", () => {
    const r = describirEntrada(entrada("factura", "facturas", {
      folio: "F-0001",
      monto: 5000,
      moneda: "MXN",
    }));
    expect(r.titulo).toBe("Generó factura F-0001");
    expect(r.contexto).toContain("5,000");
    expect(r.contexto).toContain("MXN");
  });

  it("describirEntrada: crear embarque con modo y tipo", () => {
    const r = describirEntrada(entrada("crear", "embarques", {
      modo: "Marítimo",
      tipo: "Importación",
      cliente: "ABC Corp",
    }));
    expect(r.titulo).toContain("Creó embarque");
    expect(r.titulo).toContain("marítimo");
    expect(r.contexto).toContain("ABC Corp");
  });

  it("describirEntrada: crear cliente genera artículo correcto (un cliente)", () => {
    const r = describirEntrada(entrada("crear", "clientes"));
    expect(r.titulo).toBe("Creó un cliente");
  });

  it("describirEntrada: crear cotización usa artículo femenino", () => {
    const r = describirEntrada(entrada("crear", "cotizaciones"));
    expect(r.titulo).toBe("Creó una cotización");
  });

  it("describirEntrada: editar embarque muestra cliente y modo", () => {
    const r = describirEntrada(entrada("editar", "embarques", { cliente: "XYZ", modo: "Aéreo" }));
    expect(r.titulo).toBe("Editó embarque");
    expect(r.contexto).toContain("XYZ");
  });

  it("describirEntrada: editar_cliente mapeado a editar genérico para clientes", () => {
    const r = describirEntrada(entrada("editar_cliente", "clientes"));
    expect(r.titulo).toBe("Editó cliente");
  });

  it("describirEntrada: eliminar proveedor", () => {
    const r = describirEntrada(entrada("eliminar", "proveedores"));
    expect(r.titulo).toBe("Eliminó proveedor");
  });

  it("describirEntrada: acción desconocida → título capitalizado", () => {
    const r = describirEntrada(entrada("sync_datos", "misc"));
    expect(r.titulo).toBe("Sync datos");
  });

  it("GRUPOS_ACCION: tiene exactamente 8 grupos definidos", () => {
    expect(GRUPOS_ACCION).toHaveLength(8);
  });

  it("GRUPOS_ACCION: el grupo 'documentos' contiene subir y eliminar", () => {
    const g = GRUPOS_ACCION.find((x) => x.valor === "documentos");
    expect(g?.acciones).toContain("subir_documento");
    expect(g?.acciones).toContain("eliminar_documento");
  });
});
