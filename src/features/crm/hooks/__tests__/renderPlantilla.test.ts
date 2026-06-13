import { describe, it, expect } from "vitest";
import { renderPlantilla } from "@/features/crm/hooks/usePlantillasMensaje";

describe("renderPlantilla", () => {
  it("sustituye variables simples", () => {
    expect(
      renderPlantilla("Hola {{contacto}} de {{empresa}}", {
        contacto: "Ana", empresa: "ACME",
      }),
    ).toBe("Hola Ana de ACME");
  });

  it("tolera espacios alrededor del nombre de la variable", () => {
    expect(renderPlantilla("{{  nombre  }}", { nombre: "Luis" })).toBe("Luis");
  });

  it("reemplaza null/undefined por cadena vacía", () => {
    expect(renderPlantilla("X={{a}}Y={{b}}", { a: null, b: undefined })).toBe("X=Y=");
  });

  it("convierte números a string", () => {
    expect(renderPlantilla("Total: {{monto}}", { monto: 1234.5 })).toBe("Total: 1234.5");
  });

  it("deja literal una variable no provista", () => {
    expect(renderPlantilla("Hola {{nope}}", {})).toBe("Hola ");
  });
});
