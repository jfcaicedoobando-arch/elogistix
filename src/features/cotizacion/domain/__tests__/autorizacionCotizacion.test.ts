import { describe, expect, it } from "vitest";
import { esAutorizadorCotizacion, estadoAutorizacion, requiereAutorizacionParaAvanzar } from "../autorizacionCotizacion";

describe("autorización de cotizaciones", () => {
  it("borrador sin solicitar, por autorizar y autorizada", () => {
    expect(estadoAutorizacion({ estado: "Borrador" })).toBe("sin_solicitar");
    expect(estadoAutorizacion({ estado: "Borrador", autorizacion_solicitada_at: "x" })).toBe("por_autorizar");
    expect(estadoAutorizacion({ estado: "Borrador", autorizada_at: "x" })).toBe("autorizada");
  });
  it("una enviada histórica no muestra autorización", () => {
    expect(estadoAutorizacion({ estado: "Enviada" })).toBe("no_aplica");
  });
  it("sin autorización no se puede enviar desde borrador", () => {
    expect(requiereAutorizacionParaAvanzar("Borrador", null)).toBe(true);
    expect(requiereAutorizacionParaAvanzar("Borrador", "2026-11-05")).toBe(false);
  });
  it("autorizan admin y gerente comercial; vendedor no", () => {
    expect(esAutorizadorCotizacion("gerente_comercial")).toBe(true);
    expect(esAutorizadorCotizacion("admin")).toBe(true);
    expect(esAutorizadorCotizacion("vendedor")).toBe(false);
  });
});
