import { describe, it, expect, vi } from "vitest";
import {
  validateDatosGenerales,
  isDatosGeneralesValid,
  mapConceptosCostoFromCotizacion,
  resolveExpedienteForSubmit,
  buildBitacoraDetalles,
} from "../embarqueWizard";

describe("validateDatosGenerales", () => {
  it("devuelve errores cuando faltan todos los campos", () => {
    const errors = validateDatosGenerales({});
    expect(errors.modo).toBeDefined();
    expect(errors.tipo).toBeDefined();
    expect(errors.clienteId).toBeDefined();
    expect(errors.descripcionMercancia).toBeDefined();
  });

  it("acepta entradas completas", () => {
    expect(
      isDatosGeneralesValid({
        modo: "Marítimo",
        tipo: "Importación",
        clienteId: "abc",
        descripcionMercancia: "Equipo industrial",
      }),
    ).toBe(true);
  });

  it("rechaza descripción solo con espacios", () => {
    const errors = validateDatosGenerales({
      modo: "Marítimo",
      tipo: "Importación",
      clienteId: "abc",
      descripcionMercancia: "   ",
    });
    expect(errors.descripcionMercancia).toBeDefined();
  });
});

describe("mapConceptosCostoFromCotizacion", () => {
  it("resuelve proveedorId por nombre cuando existe", () => {
    const result = mapConceptosCostoFromCotizacion(
      [{ proveedor: "MAERSK", concepto: "Flete", costo_unitario: 1000, moneda: "USD" }],
      [{ id: "p1", nombre: "MAERSK" }],
    );
    expect(result[0].proveedorId).toBe("p1");
    expect(result[0].monto).toBe(1000);
    expect(result[0].moneda).toBe("USD");
  });

  it("deja proveedorId vacío si no encuentra match", () => {
    const result = mapConceptosCostoFromCotizacion(
      [{ proveedor: "DESCONOCIDO", concepto: "X", costo_unitario: "0", moneda: null }],
      [{ id: "p1", nombre: "MAERSK" }],
    );
    expect(result[0].proveedorId).toBe("");
    expect(result[0].moneda).toBe("MXN");
  });
});

describe("resolveExpedienteForSubmit", () => {
  it("reutiliza el expediente existente sin llamar al resolver", async () => {
    const resolver = vi.fn();
    const out = await resolveExpedienteForSubmit({
      modoExpediente: "existente",
      expedienteSeleccionado: { expediente: "EXP-OLD" },
      blMaster: "BLM",
      tipo: "Importación",
      resolverNuevo: resolver,
    });
    expect(out).toBe("EXP-OLD");
    expect(resolver).not.toHaveBeenCalled();
  });

  it("delega a resolverNuevo cuando modo=nuevo", async () => {
    const resolver = vi.fn().mockResolvedValue("EXP-2026-001");
    const out = await resolveExpedienteForSubmit({
      modoExpediente: "nuevo",
      expedienteSeleccionado: null,
      blMaster: "BLM-X",
      tipo: "Importación",
      resolverNuevo: resolver,
    });
    expect(out).toBe("EXP-2026-001");
    expect(resolver).toHaveBeenCalledWith("BLM-X", "Importación");
  });

  it("delega a resolverNuevo si modo=existente pero no hay seleccionado", async () => {
    const resolver = vi.fn().mockResolvedValue("EXP-NEW");
    const out = await resolveExpedienteForSubmit({
      modoExpediente: "existente",
      expedienteSeleccionado: null,
      blMaster: "B", tipo: "T",
      resolverNuevo: resolver,
    });
    expect(out).toBe("EXP-NEW");
    expect(resolver).toHaveBeenCalled();
  });
});

describe("buildBitacoraDetalles", () => {
  it("marca asociado_a_existente=true cuando modoExpediente=existente", () => {
    const d = buildBitacoraDetalles({
      modo: "Marítimo", tipo: "Importación", clienteNombre: "ACME",
      cotizacionFolio: "COT-1", modoExpediente: "existente",
    });
    expect(d).toEqual({
      modo: "Marítimo", tipo: "Importación", cliente: "ACME",
      cotizacion_folio: "COT-1", asociado_a_existente: true,
    });
  });

  it("asociado_a_existente=false y conserva folio null", () => {
    const d = buildBitacoraDetalles({
      modo: "Aéreo", tipo: "Exportación", clienteNombre: "X",
      cotizacionFolio: null, modoExpediente: "nuevo",
    });
    expect(d.asociado_a_existente).toBe(false);
    expect(d.cotizacion_folio).toBeNull();
  });
});
