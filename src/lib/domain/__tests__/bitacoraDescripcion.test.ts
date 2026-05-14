import { describe, it, expect } from "vitest";
import { describirEntrada } from "@/lib/domain/bitacoraDescripcion";
import type { EntradaBitacora } from "@/hooks/shared/useBitacora";

const base = (overrides: Partial<EntradaBitacora>): EntradaBitacora => ({
  id: "1",
  usuario_id: "u",
  usuario_email: "x@y.com",
  accion: "crear",
  modulo: "embarques",
  entidad_id: "e",
  entidad_nombre: "EXP-001",
  detalles: {},
  created_at: new Date().toISOString(),
  ...overrides,
});

describe("describirEntrada", () => {
  it("login", () => {
    expect(describirEntrada(base({ accion: "login", modulo: "auth" })).titulo).toBe("Inició sesión");
  });

  it("cambio de estado con anterior y nuevo", () => {
    const r = describirEntrada(
      base({ accion: "cambiar_estado", detalles: { estado_anterior: "Arribo", estado_nuevo: "En Aduana" } })
    );
    expect(r.titulo).toContain("Arribo");
    expect(r.titulo).toContain("En Aduana");
    expect(r.estadoAnterior).toBe("Arribo");
    expect(r.estadoNuevo).toBe("En Aduana");
  });

  it("crear embarque con modo/tipo/cliente", () => {
    const r = describirEntrada(
      base({ detalles: { modo: "Marítimo", tipo: "Importación", cliente: "ACME" } })
    );
    expect(r.titulo).toBe("Creó embarque marítimo de importación");
    expect(r.contexto).toBe("ACME");
  });

  it("editar embarque", () => {
    const r = describirEntrada(
      base({ accion: "editar", detalles: { cliente: "ACME", modo: "Aéreo" } })
    );
    expect(r.titulo).toBe("Editó embarque");
    expect(r.contexto).toBe("ACME · Aéreo");
  });

  it("subir documento", () => {
    const r = describirEntrada(
      base({ accion: "subir_documento", detalles: { tipo_documento: "BL Master" } })
    );
    expect(r.titulo).toBe("Subió BL Master");
  });

  it("agregar nota recorta a 80 chars", () => {
    const largo = "a".repeat(120);
    const r = describirEntrada(base({ accion: "agregar_nota", detalles: { contenido: largo } }));
    expect(r.contexto?.endsWith("…")).toBe(true);
  });

  it("crear cliente genérico", () => {
    const r = describirEntrada(base({ accion: "crear", modulo: "clientes", detalles: {} }));
    expect(r.titulo).toBe("Creó un cliente");
  });

  it("fallback capitaliza accion desconocida", () => {
    const r = describirEntrada(base({ accion: "accion_rara", detalles: {} }));
    expect(r.titulo).toBe("Accion rara");
  });
});
