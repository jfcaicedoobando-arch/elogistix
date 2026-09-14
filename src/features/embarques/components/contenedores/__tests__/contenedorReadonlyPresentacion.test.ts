import { describe, expect, it } from "vitest";
import {
  esMarcadorContenedor,
  valorCargaCapturada,
} from "../contenedorReadonlyPresentacion";

describe("presentación de carga del contenedor", () => {
  it("trata ceros de un marcador sin número como no capturados", () => {
    const marcador = { numero_contenedor: "", peso_kg: 0, volumen_m3: 0, piezas: 0 };
    expect(esMarcadorContenedor(marcador)).toBe(true);
    expect(valorCargaCapturada(marcador, "peso_kg")).toBeNull();
    expect(valorCargaCapturada(marcador, "volumen_m3")).toBeNull();
    expect(valorCargaCapturada(marcador, "piezas")).toBeNull();
  });

  it("conserva cero cuando pertenece a un contenedor capturado", () => {
    const capturado = { numero_contenedor: "MSCU1234567", peso_kg: 0 };
    expect(esMarcadorContenedor(capturado)).toBe(false);
    expect(valorCargaCapturada(capturado, "peso_kg")).toBe(0);
  });
});