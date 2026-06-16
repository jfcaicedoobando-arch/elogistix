/**
 * Tests para `buildDesvincularCotizacionUpdates` — la lógica que decide qué
 * campos limpiar al desvincular una cotización del wizard de embarque.
 *
 * Casos críticos cubiertos:
 *   - modo "conservar"/"solo-conceptos" → no toca nada
 *   - modo "limpiar" sin snapshot → limpia TODOS los defaults
 *   - modo "limpiar" con snapshot+current → respeta campos que el usuario tocó
 *   - arrays: limpia solo si la longitud no cambió
 */
import { describe, it, expect } from "vitest";
import { buildDesvincularCotizacionUpdates } from "../embarqueCotizacionDesvincular";
import type { VincularSnapshot } from "../embarqueCotizacion";
import type { EmbarqueFormValues } from "../embarqueFromDb";

describe("buildDesvincularCotizacionUpdates — pure unit", () => {
  it("modo 'conservar' → array vacío (no se toca nada)", () => {
    expect(buildDesvincularCotizacionUpdates("conservar")).toEqual([]);
  });

  it("modo 'solo-conceptos' → array vacío (caller maneja conceptos)", () => {
    expect(buildDesvincularCotizacionUpdates("solo-conceptos")).toEqual([]);
  });

  it("modo 'limpiar' por defecto sin args → limpia todos los defaults", () => {
    const updates = buildDesvincularCotizacionUpdates();
    expect(updates.length).toBeGreaterThan(20);
    const fields = updates.map(([f]) => f);
    expect(fields).toContain("clienteId");
    expect(fields).toContain("tarifaId");
    expect(fields).toContain("cartaGarantia");
  });

  it("modo 'limpiar' sin snapshot → devuelve TODOS los defaults completos", () => {
    const updates = buildDesvincularCotizacionUpdates("limpiar");
    // contenedores limpia a array vacío; cartaGarantia a false
    const cont = updates.find(([f]) => f === "contenedores");
    expect(cont?.[1]).toEqual([]);
    const cg = updates.find(([f]) => f === "cartaGarantia");
    expect(cg?.[1]).toBe(false);
  });

  it("Opción A: limpia solo campos que el usuario NO modificó (igual al snapshot)", () => {
    const snapshot = {
      clienteId: "cli-1",
      modo: "Marítimo",
      descripcionMercancia: "Original",
    } as unknown as VincularSnapshot;
    const current = {
      clienteId: "cli-1", // sin cambios → debe limpiarse
      modo: "Aéreo", // el usuario lo cambió → NO debe limpiarse
      descripcionMercancia: "Editado", // tocado → conservar
    } as Partial<EmbarqueFormValues>;

    const updates = buildDesvincularCotizacionUpdates("limpiar", snapshot, current);
    const fields = updates.map(([f]) => f);
    expect(fields).toContain("clienteId");
    expect(fields).not.toContain("modo");
    expect(fields).not.toContain("descripcionMercancia");
  });

  it("Campo del default NO presente en snapshot → se limpia igual", () => {
    const snapshot = { clienteId: "cli-1" } as unknown as VincularSnapshot;
    const current = { clienteId: "cli-1" } as Partial<EmbarqueFormValues>;
    const updates = buildDesvincularCotizacionUpdates("limpiar", snapshot, current);
    const fields = updates.map(([f]) => f);
    expect(fields).toContain("tarifaId"); // tarifaId no estaba en snapshot
    expect(fields).toContain("notas");
  });

  it("Arrays: limpia solo si la longitud se mantiene (usuario no agregó/quitó)", () => {
    const snapshot = {
      clienteId: "x",
      contenedores: [{ tipo: "20ft" }, { tipo: "40ft" }],
    } as unknown as VincularSnapshot;
    const currentIgual = {
      clienteId: "x",
      contenedores: [{ tipo: "20ft" }, { tipo: "40ft" }],
    } as unknown as Partial<EmbarqueFormValues>;
    const currentDistinto = {
      clienteId: "x",
      contenedores: [{ tipo: "20ft" }], // usuario removió uno
    } as unknown as Partial<EmbarqueFormValues>;

    const a = buildDesvincularCotizacionUpdates("limpiar", snapshot, currentIgual);
    expect(a.map(([f]) => f)).toContain("contenedores");

    const b = buildDesvincularCotizacionUpdates("limpiar", snapshot, currentDistinto);
    expect(b.map(([f]) => f)).not.toContain("contenedores");
  });

  it("Coerción nulo/undefined: '' === null === undefined al comparar", () => {
    const snapshot = { pesoKg: null } as unknown as VincularSnapshot;
    const current = { pesoKg: "" } as Partial<EmbarqueFormValues>;
    const updates = buildDesvincularCotizacionUpdates("limpiar", snapshot, current);
    expect(updates.map(([f]) => f)).toContain("pesoKg");
  });
});
