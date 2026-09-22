/**
 * Pasos cubiertos:
 * 1. Marítimo LCL con número de contenedor vacío puede guardarse.
 * 2. Marítimo LCL con número informado sigue validando ISO 6346.
 * 3. Marítimo FCL sin número/tipo sigue bloqueando en el paso 2.
 */
import { describe, it, expect } from "vitest";
import { validarContenedoresMaritimo } from "../useEditarEmbarqueWizard.helpers";
import type { ContenedorBorrador } from "@/features/embarques/types/contenedor";

const fila = (over: Partial<ContenedorBorrador> = {}): ContenedorBorrador => ({
  numero_contenedor: "",
  tipo_contenedor: "LCL",
  ...over,
} as ContenedorBorrador);

describe("validarContenedoresMaritimo", () => {
  it("LCL con número vacío no bloquea el guardado", () => {
    expect(validarContenedoresMaritimo("Marítimo", [fila()], "LCL")).toBeNull();
  });

  it("LCL con número informado inválido devuelve error ISO 6346", () => {
    const res = validarContenedoresMaritimo("Marítimo", [fila({ numero_contenedor: "ABC123" })], "LCL");
    expect(res?.step).toBe(2);
    expect(res?.description).toContain("inválido");
  });

  it("FCL sin número sigue bloqueando", () => {
    const res = validarContenedoresMaritimo("Marítimo", [fila({ tipo_contenedor: "40HC" })], "FCL");
    expect(res).toEqual({
      description: "Cada contenedor requiere número y tipo. Revisa el paso 2.",
      step: 2,
    });
  });

  it("no marítimo no valida contenedores", () => {
    expect(validarContenedoresMaritimo("Aéreo", [fila()], null)).toBeNull();
  });
});
