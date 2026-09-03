import { describe, it, expect } from "vitest";
import {
  destinatarioSchema,
  rutaTerrestreSchema,
  fleteLclManualSchema,
  costosPaso2Schema,
  conceptosPaso3Schema,
  primerError,
} from "../wizardPasos";

describe("wizardPasos · Paso 1 destinatario", () => {
  it("exige cliente cuando no es prospecto", () => {
    expect(
      primerError(destinatarioSchema, {
        esProspecto: false,
        clienteId: null,
        prospectoEmpresa: "",
        prospectoContacto: "",
      }),
    ).toBe("Selecciona un cliente.");
  });

  it("acepta cliente seleccionado", () => {
    expect(
      primerError(destinatarioSchema, {
        esProspecto: false,
        clienteId: "c-1",
        prospectoEmpresa: "",
        prospectoContacto: "",
      }),
    ).toBeNull();
  });

  it("modo vincular sin lead ni oportunidad falla", () => {
    expect(
      primerError(destinatarioSchema, {
        esProspecto: true,
        prospectoModo: "vincular",
        prospectoEmpresa: "ACME",
        prospectoContacto: "",
      }),
    ).toContain("Selecciona un lead u oportunidad");
  });

  it("el cotizador ya no crea prospectos: siempre exige vincular uno existente", () => {
    // v13.823.x — se cerró la creación lateral de leads desde el cotizador.
    expect(
      primerError(destinatarioSchema, {
        esProspecto: true,
        prospectoModo: "nuevo",
        prospectoEmpresa: "ACME",
        prospectoContacto: "Juan",
      }),
    ).toContain("Selecciona un lead u oportunidad");
    expect(
      primerError(destinatarioSchema, {
        esProspecto: true,
        prospectoModo: "vincular",
        prospectoEmpresa: "ACME",
        prospectoContacto: "Juan",
        oportunidadId: "op-1",
      }),
    ).toBeNull();
  });
});

describe("wizardPasos · Paso 1 ruta y flete", () => {
  it("ignora reglas terrestres en marítimo", () => {
    expect(primerError(rutaTerrestreSchema, { modo: "Marítimo" })).toBeNull();
  });

  it("terrestre exige modalidad y punto intermedio en porta contenedor", () => {
    expect(primerError(rutaTerrestreSchema, { modo: "Terrestre" })).toBe(
      "Selecciona la modalidad de equipo.",
    );
    expect(
      primerError(rutaTerrestreSchema, {
        modo: "Terrestre",
        modalidadEquipo: "Porta Contenedor",
      }),
    ).toBe("Captura el punto de carga/descarga.");
    expect(
      primerError(rutaTerrestreSchema, {
        modo: "Terrestre",
        modalidadEquipo: "Porta Contenedor",
        puntoIntermedio: "Manzanillo",
      }),
    ).toBeNull();
  });

  it("flete LCL manual exige tarifa W/M y consolidador", () => {
    expect(primerError(fleteLclManualSchema, { tarifaWM: 0, consolidadorId: "p-1" })).toContain(
      "Captura el flete LCL",
    );
    expect(primerError(fleteLclManualSchema, { tarifaWM: 45, consolidadorId: " " })).toContain(
      "Captura el flete LCL",
    );
    expect(primerError(fleteLclManualSchema, { tarifaWM: 45, consolidadorId: "p-1" })).toBeNull();
  });
});

describe("wizardPasos · Pasos 2 y 3", () => {
  it("paso 2 exige costos y conceptos por renglón", () => {
    expect(primerError(costosPaso2Schema, { totalCostos: 0, renglonesSinConcepto: 0 })).toBe(
      "Agrega al menos un costo interno antes de continuar.",
    );
    expect(primerError(costosPaso2Schema, { totalCostos: 3, renglonesSinConcepto: 1 })).toBe(
      "Hay renglones de costo sin concepto.",
    );
    expect(primerError(costosPaso2Schema, { totalCostos: 3, renglonesSinConcepto: 0 })).toBeNull();
  });

  it("paso 3 exige al menos un concepto de venta", () => {
    expect(primerError(conceptosPaso3Schema, { conceptosValidos: 0 })).toBe(
      "Agrega al menos un concepto de venta.",
    );
    expect(primerError(conceptosPaso3Schema, { conceptosValidos: 2 })).toBeNull();
  });
});
