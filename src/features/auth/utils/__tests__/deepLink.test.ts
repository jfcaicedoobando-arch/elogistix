import { describe, it, expect } from "vitest";
import { isDeepLinkPermitido, resolveDeepLinkDestino } from "../deepLink";

describe("isDeepLinkPermitido (P-07)", () => {
  it("rechaza rutas ausentes, externas y protocol-relative", () => {
    expect(isDeepLinkPermitido("cliente", undefined)).toBe(false);
    expect(isDeepLinkPermitido("cliente", null)).toBe(false);
    expect(isDeepLinkPermitido("cliente", "//evil.com/portal")).toBe(false);
    expect(isDeepLinkPermitido("cliente", "https://evil.com")).toBe(false);
  });

  it("rechaza el propio login y la raíz para no rebotar", () => {
    expect(isDeepLinkPermitido("admin", "/login")).toBe(false);
    expect(isDeepLinkPermitido("admin", "/")).toBe(false);
  });

  it("el rol cliente sólo puede aterrizar dentro de /portal", () => {
    expect(isDeepLinkPermitido("cliente", "/portal/embarques")).toBe(true);
    expect(isDeepLinkPermitido("cliente", "/portal")).toBe(true);
    expect(isDeepLinkPermitido("cliente", "/cotizaciones")).toBe(false);
    // No confundir un prefijo textual con el área real.
    expect(isDeepLinkPermitido("cliente", "/portalizado")).toBe(false);
  });

  it("el rol agente_carga sólo puede aterrizar dentro de /agente", () => {
    expect(isDeepLinkPermitido("agente_carga", "/agente/tarifas")).toBe(true);
    expect(isDeepLinkPermitido("agente_carga", "/portal/embarques")).toBe(false);
  });

  it("los roles internos nunca aterrizan en áreas externas", () => {
    expect(isDeepLinkPermitido("admin", "/facturacion")).toBe(true);
    expect(isDeepLinkPermitido("tesorero", "/tesoreria/conciliacion")).toBe(true);
    expect(isDeepLinkPermitido("admin", "/portal/embarques")).toBe(false);
    expect(isDeepLinkPermitido("admin", "/agente")).toBe(false);
  });

  it("sin rol se trata como interno", () => {
    expect(isDeepLinkPermitido(null, "/portal")).toBe(false);
    expect(isDeepLinkPermitido(undefined, "/clientes")).toBe(true);
  });
});

describe("resolveDeepLinkDestino", () => {
  it("conserva el query string cuando la ruta es válida", () => {
    expect(
      resolveDeepLinkDestino("cliente", { pathname: "/portal/embarques", search: "?estado=EnTransito" }),
    ).toBe("/portal/embarques?estado=EnTransito");
  });

  it("devuelve null cuando no hay from o la ruta no está permitida", () => {
    expect(resolveDeepLinkDestino("cliente", null)).toBeNull();
    expect(resolveDeepLinkDestino("cliente", undefined)).toBeNull();
    expect(resolveDeepLinkDestino("cliente", { pathname: "/facturacion" })).toBeNull();
  });

  it("no agrega search cuando no existe", () => {
    expect(resolveDeepLinkDestino("admin", { pathname: "/clientes" })).toBe("/clientes");
  });
});
