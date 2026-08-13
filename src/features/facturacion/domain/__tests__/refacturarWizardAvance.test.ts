import { describe, it, expect } from "vitest";
import { decidirAvance, type AvanceArgs } from "../refacturarWizardAvance";

const base: AvanceArgs = {
  paso: 1,
  facturaId: "f-1",
  casoId: null,
  facturaNuevaId: null,
  clienteDestinoId: null,
  pagoSeleccionadoId: null,
  yaReasignado: false,
};

describe("decidirAvance", () => {
  it("paso 1 sin cliente destino no hace nada", () => {
    expect(decidirAvance(base)).toEqual({ tipo: "nada" });
  });

  it("paso 1 con cliente destino abre el caso", () => {
    expect(decidirAvance({ ...base, clienteDestinoId: "c-1" })).toEqual({ tipo: "abrir" });
  });

  it("paso 1 con caso existente sólo avanza al paso 2", () => {
    expect(decidirAvance({ ...base, casoId: "caso-1" })).toEqual({ tipo: "avanzar", paso: 2 });
  });

  it("pasos intermedios avanzan uno a uno", () => {
    expect(decidirAvance({ ...base, paso: 3, casoId: "caso-1" })).toEqual({
      tipo: "avanzar",
      paso: 4,
    });
  });

  it("último paso reasigna el pago cuando hay datos completos", () => {
    expect(
      decidirAvance({
        ...base,
        paso: 5,
        casoId: "caso-1",
        facturaNuevaId: "f-2",
        pagoSeleccionadoId: "p-1",
      }),
    ).toEqual({
      tipo: "reasignar",
      pagoId: "p-1",
      facturaDestinoId: "f-2",
      casoId: "caso-1",
    });
  });

  it("último paso cierra el caso si el pago ya fue reasignado", () => {
    expect(decidirAvance({ ...base, paso: 5, casoId: "caso-1", yaReasignado: true })).toEqual({
      tipo: "cerrar",
    });
  });

  it("último paso sin pago seleccionado no hace nada", () => {
    expect(decidirAvance({ ...base, paso: 5, casoId: "caso-1", facturaNuevaId: "f-2" })).toEqual({
      tipo: "nada",
    });
  });
});
