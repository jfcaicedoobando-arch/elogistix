import { describe, it, expect } from "vitest";
import { campoParaErrorPaso1 } from "../scrollToErrorSection";

describe("campoParaErrorPaso1", () => {
  it("mapea el error de cliente", () => {
    expect(campoParaErrorPaso1("Selecciona un cliente.")).toBe("clienteId");
  });

  it("mapea los errores de prospecto", () => {
    expect(campoParaErrorPaso1("Ingresa el nombre de la empresa del prospecto")).toBe(
      "prospectoEmpresa",
    );
    expect(campoParaErrorPaso1("Ingresa el nombre del contacto del prospecto")).toBe(
      "prospectoContacto",
    );
  });

  it("mapea los errores terrestres", () => {
    expect(campoParaErrorPaso1("Selecciona la modalidad de equipo.")).toBe("modalidadEquipo");
    expect(campoParaErrorPaso1("Captura el punto de carga/descarga.")).toBe("puntoIntermedio");
  });

  it("mapea los errores de tarifa", () => {
    expect(
      campoParaErrorPaso1(
        "Vincula o crea una tarifa marítima antes de continuar (Paso 1 → Tarifa marítima vinculada).",
      ),
    ).toBe("tarifaId");
  });

  it("devuelve null cuando el mensaje no corresponde a un campo", () => {
    expect(campoParaErrorPaso1("Algo salió mal en el servidor")).toBeNull();
  });
});
