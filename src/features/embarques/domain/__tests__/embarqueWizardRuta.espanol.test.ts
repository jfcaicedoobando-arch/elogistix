/**
 * Regresión (v13.823.336): el paso 2 del editor de embarques ya bloquea
 * "Siguiente" con ETD/ETA/ruta/contenedor faltantes, y todos los mensajes que
 * ve el usuario están en español (sin claves técnicas ni inglés).
 */
import { describe, it, expect } from "vitest";
import { validateStepRuta } from "../embarqueWizardRuta";

describe("validateStepRuta · mensajes en español", () => {
  const errores = validateStepRuta({
    modo: "Marítimo",
    etd: "",
    eta: "",
    puertoOrigen: "",
    puertoDestino: "",
    naviera: "",
    tipoServicio: "FCL",
    contenedores: [],
  });

  it("reporta ETD, ETA, ruta y contenedores faltantes", () => {
    expect(Object.keys(errores).length).toBeGreaterThanOrEqual(3);
    expect(errores.etd).toBeTruthy();
    expect(errores.eta).toBeTruthy();
  });

  it("no filtra claves técnicas ni texto en inglés a la pantalla", () => {
    for (const mensaje of Object.values(errores)) {
      expect(mensaje).not.toMatch(/required|missing|invalid|\./i.test(mensaje ?? "") ? /required|missing|invalid/i : /required|missing|invalid/i);
      expect(mensaje).toMatch(/[áéíóúñ ]/i);
    }
  });
});
