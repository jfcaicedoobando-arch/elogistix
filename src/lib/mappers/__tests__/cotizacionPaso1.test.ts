import { describe, it, expect } from "vitest";
import { buildPaso1Data } from "@/lib/mappers/cotizacion";
import { COTIZACION_FORM_DEFAULTS } from "@/types/cotizacionForm";

describe("cotizacion · buildPaso1Data", () => {
  it("calcula peso/volumen/piezas a partir de dimensiones LCL marítimas", () => {
    const out = buildPaso1Data(
      {
        ...COTIZACION_FORM_DEFAULTS,
        esProspecto: false,
        clienteId: "cli-1",
        modo: "Marítimo",
        tipoEmbarque: "LCL",
        dimensionesLCL: [
          { piezas: 2, alto_cm: 10, largo_cm: 10, ancho_cm: 10, volumen_m3: 1.5 },
          { piezas: 3, alto_cm: 10, largo_cm: 10, ancho_cm: 10, volumen_m3: 0.5 },
        ],
      },
      [{ id: "cli-1", nombre: "ACME" }],
      "op@x",
    );
    expect(out.peso_kg).toBe(0);
    expect(out.volumen_m3).toBe(2);
    expect(out.piezas).toBe(5);
    expect(out.cliente_nombre).toBe("ACME");
    expect(out.es_prospecto).toBe(false);
  });

  it("suma peso volumétrico cuando el modo es Aéreo", () => {
    const out = buildPaso1Data(
      {
        ...COTIZACION_FORM_DEFAULTS,
        modo: "Aéreo",
        dimensionesAereas: [
          { piezas: 1, alto_cm: 10, largo_cm: 10, ancho_cm: 10, peso_volumetrico_kg: 50 },
          { piezas: 2, alto_cm: 10, largo_cm: 10, ancho_cm: 10, peso_volumetrico_kg: 25 },
        ],
      },
      [],
      "op@x",
    );
    expect(out.peso_kg).toBe(75);
    expect(out.volumen_m3).toBe(0);
    expect(out.piezas).toBe(3);
  });

  it("usa datos del prospecto cuando es_prospecto=true", () => {
    const out = buildPaso1Data(
      {
        ...COTIZACION_FORM_DEFAULTS,
        esProspecto: true,
        prospectoEmpresa: "Prospecto SA",
        prospectoEmail: "p@x.com",
      },
      [],
      "op@x",
    );
    expect(out.cliente_id).toBeNull();
    expect(out.cliente_nombre).toBe("Prospecto SA");
    expect(out.prospecto_email).toBe("p@x.com");
  });
});
