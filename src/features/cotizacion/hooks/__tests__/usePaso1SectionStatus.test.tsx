/**
 * Tests de cobertura de ramas para usePaso1SectionStatus.
 */
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useForm, FormProvider } from "react-hook-form";
import type { ReactNode } from "react";
import { usePaso1SectionStatus } from "@/features/cotizacion/hooks/usePaso1SectionStatus";
import type { CotizacionFormValues } from "@/features/cotizacion/types";

function wrapperFactory(defaultValues: Partial<CotizacionFormValues>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const methods = useForm<CotizacionFormValues>({
      defaultValues: defaultValues as CotizacionFormValues,
    });
    return <FormProvider {...methods}>{children}</FormProvider>;
  };
}

function statusFor(defaultValues: Partial<CotizacionFormValues>) {
  const { result } = renderHook(() => usePaso1SectionStatus(), {
    wrapper: wrapperFactory(defaultValues),
  });
  return result.current;
}

describe("usePaso1SectionStatus — cliente", () => {
  it("cliente: false cuando no es prospecto y no hay clienteId", () => {
    expect(statusFor({ esProspecto: false, clienteId: "" }).cliente).toBe(false);
  });

  it("cliente: true cuando no es prospecto y hay clienteId", () => {
    expect(statusFor({ esProspecto: false, clienteId: "c-1" }).cliente).toBe(true);
  });

  it("cliente: false cuando es prospecto sin empresa", () => {
    expect(
      statusFor({ esProspecto: true, prospectoEmpresa: "  ", oportunidadId: "op-1" }).cliente,
    ).toBe(false);
  });

  it("cliente: false cuando es prospecto con empresa pero sin vínculo CRM", () => {
    expect(
      statusFor({
        esProspecto: true,
        prospectoEmpresa: "ACME",
        oportunidadId: "",
        leadId: "",
      }).cliente,
    ).toBe(false);
  });

  it("cliente: true cuando es prospecto con empresa y oportunidad vinculada", () => {
    expect(
      statusFor({ esProspecto: true, prospectoEmpresa: "ACME", oportunidadId: "op-1" }).cliente,
    ).toBe(true);
  });

  it("cliente: true cuando es prospecto con empresa y lead vinculado", () => {
    expect(
      statusFor({ esProspecto: true, prospectoEmpresa: "ACME", leadId: "lead-1" }).cliente,
    ).toBe(true);
  });
});

describe("usePaso1SectionStatus — operacion", () => {
  it("false si falta modo/tipo/incoterm", () => {
    expect(statusFor({ modo: "", tipo: "Importación", incoterm: "FOB" }).operacion).toBe(false);
    expect(statusFor({ modo: "Marítimo", tipo: "", incoterm: "FOB" }).operacion).toBe(false);
    expect(statusFor({ modo: "Marítimo", tipo: "Importación", incoterm: "" }).operacion).toBe(false);
  });

  it("true cuando los tres campos están capturados", () => {
    expect(
      statusFor({ modo: "Marítimo", tipo: "Importación", incoterm: "FOB" }).operacion,
    ).toBe(true);
  });
});

describe("usePaso1SectionStatus — ruta", () => {
  it("false cuando origen/destino vacíos o sólo espacios", () => {
    expect(statusFor({ origen: "  ", destino: "CNSHA" }).ruta).toBe(false);
    expect(statusFor({ origen: "MXVER", destino: "" }).ruta).toBe(false);
  });

  it("true cuando ambos tienen contenido", () => {
    expect(statusFor({ origen: "MXVER", destino: "CNSHA" }).ruta).toBe(true);
  });
});

describe("usePaso1SectionStatus — mercancia", () => {
  it("false si no hay tipoCarga", () => {
    expect(statusFor({ tipoCarga: "" }).mercancia).toBe(false);
  });

  it("Marítimo FCL: false sin tipoContenedor o sin numContenedores", () => {
    expect(
      statusFor({
        tipoCarga: "General",
        modo: "Marítimo",
        tipoEmbarque: "FCL",
        tipoContenedor: "",
        numContenedores: 1,
      }).mercancia,
    ).toBe(false);
    expect(
      statusFor({
        tipoCarga: "General",
        modo: "Marítimo",
        tipoEmbarque: "FCL",
        tipoContenedor: "40HC",
        numContenedores: 0,
      }).mercancia,
    ).toBe(false);
  });

  it("Marítimo FCL: true con contenedor y cantidad", () => {
    expect(
      statusFor({
        tipoCarga: "General",
        modo: "Marítimo",
        tipoEmbarque: "FCL",
        tipoContenedor: "40HC",
        numContenedores: 1,
      }).mercancia,
    ).toBe(true);
  });

  it("Marítimo LCL: false sin filas válidas", () => {
    expect(
      statusFor({
        tipoCarga: "General",
        modo: "Marítimo",
        tipoEmbarque: "LCL",
        dimensionesLCL: [],
      }).mercancia,
    ).toBe(false);
    expect(
      statusFor({
        tipoCarga: "General",
        modo: "Marítimo",
        tipoEmbarque: "LCL",
        dimensionesLCL: [{ piezas: 0, volumen_m3: 5 } as never],
      }).mercancia,
    ).toBe(false);
  });

  it("Marítimo LCL: true con volumen_m3 válido", () => {
    expect(
      statusFor({
        tipoCarga: "General",
        modo: "Marítimo",
        tipoEmbarque: "LCL",
        dimensionesLCL: [{ piezas: 2, volumen_m3: 1.5 } as never],
      }).mercancia,
    ).toBe(true);
  });

  it("Marítimo LCL: true con dimensiones alto/largo/ancho válidas", () => {
    expect(
      statusFor({
        tipoCarga: "General",
        modo: "Marítimo",
        tipoEmbarque: "LCL",
        dimensionesLCL: [
          { piezas: 2, volumen_m3: 0, alto_cm: 10, largo_cm: 10, ancho_cm: 10 } as never,
        ],
      }).mercancia,
    ).toBe(true);
  });

  it("Aéreo: false sin filas válidas", () => {
    expect(
      statusFor({ tipoCarga: "General", modo: "Aéreo", dimensionesAereas: [] }).mercancia,
    ).toBe(false);
  });

  it("Aéreo: true con peso volumétrico válido (variante 'Aer')", () => {
    expect(
      statusFor({
        tipoCarga: "General",
        modo: "Aereo",
        dimensionesAereas: [{ piezas: 1, peso_volumetrico_kg: 12 } as never],
      }).mercancia,
    ).toBe(true);
  });

  it("Aéreo: true con dimensiones alto/largo/ancho válidas", () => {
    expect(
      statusFor({
        tipoCarga: "General",
        modo: "Aéreo",
        dimensionesAereas: [
          { piezas: 1, peso_volumetrico_kg: 0, alto_cm: 5, largo_cm: 5, ancho_cm: 5 } as never,
        ],
      }).mercancia,
    ).toBe(true);
  });

  it("Terrestre/default: false sin peso ni piezas", () => {
    expect(
      statusFor({ tipoCarga: "General", modo: "Terrestre", pesoKg: 0, piezas: 0 }).mercancia,
    ).toBe(false);
  });

  it("Terrestre/default: true con peso o piezas capturados", () => {
    expect(
      statusFor({ tipoCarga: "General", modo: "Terrestre", pesoKg: 100, piezas: 0 }).mercancia,
    ).toBe(true);
    expect(
      statusFor({ tipoCarga: "General", modo: "Terrestre", pesoKg: 0, piezas: 3 }).mercancia,
    ).toBe(true);
  });
});

describe("usePaso1SectionStatus — tarifa", () => {
  it("true cuando no es marítimo", () => {
    expect(statusFor({ modo: "Aéreo", tarifaId: null }).tarifa).toBe(true);
  });

  it("true cuando el incoterm exime de flete de venta", () => {
    expect(statusFor({ modo: "Marítimo", incoterm: "CIF", tarifaId: null }).tarifa).toBe(true);
  });

  it("true cuando hay tarifaId vinculada", () => {
    expect(statusFor({ modo: "Marítimo", incoterm: "FOB", tarifaId: "tar-1" }).tarifa).toBe(true);
  });

  it("LCL sin tarifaId: false sin flete manual capturado", () => {
    expect(
      statusFor({
        modo: "Marítimo",
        incoterm: "FOB",
        tarifaId: null,
        tipoEmbarque: "LCL",
        lclFleteManual: undefined,
      }).tarifa,
    ).toBe(false);
  });

  it("LCL sin tarifaId: false si tarifaWM es 0 o falta consolidador", () => {
    expect(
      statusFor({
        modo: "Marítimo",
        incoterm: "FOB",
        tarifaId: null,
        tipoEmbarque: "LCL",
        lclFleteManual: { tarifaWM: 0, consolidadorId: "cons-1" } as never,
      }).tarifa,
    ).toBe(false);
    expect(
      statusFor({
        modo: "Marítimo",
        incoterm: "FOB",
        tarifaId: null,
        tipoEmbarque: "LCL",
        lclFleteManual: { tarifaWM: 50, consolidadorId: "" } as never,
      }).tarifa,
    ).toBe(false);
  });

  it("LCL sin tarifaId: true con tarifaWM > 0 y consolidador", () => {
    expect(
      statusFor({
        modo: "Marítimo",
        incoterm: "FOB",
        tarifaId: null,
        tipoEmbarque: "LCL",
        lclFleteManual: { tarifaWM: 50, consolidadorId: "cons-1" } as never,
      }).tarifa,
    ).toBe(true);
  });

  it("FCL sin tarifaId: false (bloqueo tarifa-first)", () => {
    expect(
      statusFor({
        modo: "Marítimo",
        incoterm: "FOB",
        tarifaId: null,
        tipoEmbarque: "FCL",
      }).tarifa,
    ).toBe(false);
  });
});

describe("usePaso1SectionStatus — condiciones", () => {
  it("true cuando el incoterm exime de flete de venta", () => {
    expect(
      statusFor({ modo: "Marítimo", incoterm: "DDP", rutaTexto: "", validezPropuesta: undefined })
        .condiciones,
    ).toBe(true);
  });

  it("no marítimo: siempre true", () => {
    expect(
      statusFor({ modo: "Aéreo", incoterm: "FOB", rutaTexto: "", validezPropuesta: undefined })
        .condiciones,
    ).toBe(true);
  });

  it("marítimo: false sin rutaTexto o sin validezPropuesta", () => {
    expect(
      statusFor({
        modo: "Marítimo",
        incoterm: "FOB",
        rutaTexto: "  ",
        validezPropuesta: new Date(),
      }).condiciones,
    ).toBe(false);
    expect(
      statusFor({
        modo: "Marítimo",
        incoterm: "FOB",
        rutaTexto: "Ruta A",
        validezPropuesta: undefined,
      }).condiciones,
    ).toBe(false);
  });

  it("marítimo: true con rutaTexto y validezPropuesta", () => {
    expect(
      statusFor({
        modo: "Marítimo",
        incoterm: "FOB",
        rutaTexto: "Ruta A",
        validezPropuesta: new Date(),
      }).condiciones,
    ).toBe(true);
  });
});

describe("usePaso1SectionStatus — cierre", () => {
  it("LCL marítimo: siempre true (no aplica numContenedores)", () => {
    expect(
      statusFor({ modo: "Marítimo", tipoEmbarque: "LCL", numContenedores: 0 }).cierre,
    ).toBe(true);
  });

  it("no LCL: false sin numContenedores", () => {
    expect(
      statusFor({ modo: "Marítimo", tipoEmbarque: "FCL", numContenedores: 0 }).cierre,
    ).toBe(false);
  });

  it("no LCL: true con numContenedores >= 1", () => {
    expect(
      statusFor({ modo: "Marítimo", tipoEmbarque: "FCL", numContenedores: 1 }).cierre,
    ).toBe(true);
  });
});
