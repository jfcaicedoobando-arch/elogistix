import { describe, expect, it } from "vitest";
import {
  esDiaInhabilMx, esFestivoMx, motivoInhabilMx, siguienteDiaHabilMx,
} from "@/lib/date/festivosMx";
import {
  aplicarMascaraPeriodo, parsearPeriodo, ymADisplay,
} from "@/components/ui/month-picker-mx-valor";
import {
  aplicarMascaraFechaHora, parsearFechaHora, valorADisplay,
} from "@/components/ui/date-time-picker-mx-valor";

describe("festivos MX (art. 74 LFT)", () => {
  it("reconoce festivos fijos", () => {
    expect(esFestivoMx("2026-01-01")).toBe(true);
    expect(esFestivoMx("2026-05-01")).toBe(true);
    expect(esFestivoMx("2026-09-16")).toBe(true);
    expect(esFestivoMx("2026-12-25")).toBe(true);
  });

  it("reconoce festivos móviles (lunes)", () => {
    expect(esFestivoMx("2026-02-02")).toBe(true);
    expect(esFestivoMx("2026-03-16")).toBe(true);
    expect(esFestivoMx("2026-11-16")).toBe(true);
  });

  it("marca transmisión de poder sólo cada 6 años", () => {
    expect(esFestivoMx("2030-12-01")).toBe(true);
    expect(esFestivoMx("2026-12-01")).toBe(false);
  });

  it("un día hábil normal no es inhábil", () => {
    expect(esDiaInhabilMx("2026-08-13")).toBe(false);
    expect(motivoInhabilMx("2026-08-13")).toBeNull();
  });

  it("detecta fin de semana y devuelve motivo", () => {
    expect(esDiaInhabilMx("2026-08-15")).toBe(true);
    expect(motivoInhabilMx("2026-09-16")).toContain("Independencia");
  });

  it("salta al siguiente día hábil", () => {
    expect(siguienteDiaHabilMx("2026-08-15")).toBe("2026-08-17");
  });
});

describe("captura de periodo MM/AAAA", () => {
  it("enmascara dígitos", () => {
    expect(aplicarMascaraPeriodo("082026")).toBe("08/2026");
    expect(aplicarMascaraPeriodo("8/")).toBe("08/");
  });

  it("parsea y formatea", () => {
    expect(parsearPeriodo("08/2026")).toBe("2026-08");
    expect(parsearPeriodo("13/2026")).toBeNull();
    expect(ymADisplay("2026-08")).toBe("08/2026");
    expect(ymADisplay("")).toBe("");
  });
});

describe("captura de fecha y hora", () => {
  it("enmascara dígitos del teclado numérico", () => {
    expect(aplicarMascaraFechaHora("140820260930")).toBe("14/08/2026 09:30");
    expect(aplicarMascaraFechaHora("1408")).toBe("14/08");
  });

  it("parsea y formatea ida y vuelta", () => {
    expect(parsearFechaHora("14/08/2026 09:30")).toBe("2026-08-14T09:30");
    expect(parsearFechaHora("14/08/2026")).toBe("2026-08-14T09:00");
    expect(parsearFechaHora("14/08/2026 99:99")).toBeNull();
    expect(valorADisplay("2026-08-14T09:30")).toBe("14/08/2026 09:30");
    expect(valorADisplay("")).toBe("");
  });
});
