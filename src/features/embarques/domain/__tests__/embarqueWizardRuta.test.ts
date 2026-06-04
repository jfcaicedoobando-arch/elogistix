import { describe, it, expect } from "vitest";
import { validateStepRuta, sugerirETA } from "../embarqueWizardRuta";

// ─── sugerirETA ────────────────────────────────────────────────────────────

describe("sugerirETA (ruta)", () => {
  it("adds transit days to a valid ETD", () => {
    expect(sugerirETA("2024-01-10", 5)).toBe("2024-01-15");
  });

  it("returns null for null ETD", () => {
    expect(sugerirETA(null, 5)).toBeNull();
  });

  it("returns null for zero transit days", () => {
    expect(sugerirETA("2024-01-10", 0)).toBeNull();
  });

  it("returns null for negative transit days", () => {
    expect(sugerirETA("2024-01-10", -3)).toBeNull();
  });

  it("returns null for invalid date string", () => {
    expect(sugerirETA("not-a-date", 5)).toBeNull();
  });
});

// ─── validateStepRuta ──────────────────────────────────────────────────────

const validMaritimo = {
  modo: "Marítimo",
  etd: "2024-03-01",
  eta: "2024-03-20",
  puertoOrigen: "Manzanillo",
  puertoDestino: "Shanghai",
  naviera: "MSC",
  tipoServicio: "LCL",
};

describe("validateStepRuta – Marítimo LCL happy path", () => {
  it("returns no errors for a valid Marítimo LCL input", () => {
    expect(validateStepRuta(validMaritimo)).toEqual({});
  });
});

describe("validateStepRuta – missing required fields", () => {
  it("reports etd and eta required when both empty", () => {
    const errors = validateStepRuta({ ...validMaritimo, etd: "", eta: "" });
    expect(errors.etd).toBeDefined();
    expect(errors.eta).toBeDefined();
  });

  it("reports eta.afterEtd when ETA is before ETD", () => {
    const errors = validateStepRuta({ ...validMaritimo, etd: "2024-03-20", eta: "2024-03-01" });
    expect(errors.eta).toMatch(/after|ETD|posterior/i);
  });

  it("reports FCL container error when contenedores is empty", () => {
    const errors = validateStepRuta({ ...validMaritimo, tipoServicio: "FCL", contenedores: [] });
    expect(errors.contenedores).toBeDefined();
  });
});

describe("validateStepRuta – Aéreo", () => {
  it("happy path Aéreo", () => {
    const errors = validateStepRuta({
      modo: "Aéreo",
      etd: "2024-04-01",
      eta: "2024-04-05",
      aeropuertoOrigen: "MEX",
      aeropuertoDestino: "LAX",
      mawb: "123-45678901",
    });
    expect(errors).toEqual({});
  });

  it("reports missing mawb for Aéreo", () => {
    const errors = validateStepRuta({
      modo: "Aéreo",
      etd: "2024-04-01",
      eta: "2024-04-05",
      aeropuertoOrigen: "MEX",
      aeropuertoDestino: "LAX",
      mawb: "",
    });
    expect(errors.mawb).toBeDefined();
  });
});

describe("validateStepRuta – Terrestre", () => {
  it("reports missing transportista for Terrestre", () => {
    const errors = validateStepRuta({
      modo: "Terrestre",
      etd: "2024-05-01",
      eta: "2024-05-03",
      ciudadOrigen: "Monterrey",
      ciudadDestino: "CDMX",
      transportista: "",
    });
    expect(errors.transportista).toBeDefined();
  });
});
