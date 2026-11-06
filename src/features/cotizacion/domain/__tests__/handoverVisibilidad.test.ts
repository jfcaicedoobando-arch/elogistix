import { describe, expect, it } from "vitest";
import { puedeVerHandover } from "../handoverVisibilidad";

describe("lectura del handover", () => {
  it.each(["admin_org", "admin", "super_admin"] as const)("permite a %s en la empresa activa", rol => {
    expect(puedeVerHandover(rol, "empresa-a", "empresa-a")).toBe(true);
  });
  it("permite al Vendedor/KAM de la empresa", () => {
    expect(puedeVerHandover("vendedor", "empresa-a", "empresa-a")).toBe(true);
  });
  it.each(["coordinador_logistico", "gerente_operaciones"] as const)("conserva lectura para %s", rol => {
    expect(puedeVerHandover(rol, "empresa-a", "empresa-a")).toBe(true);
  });
  it.each(["admin_org", "vendedor", "super_admin"] as const)("impide mostrar datos de otra empresa a %s", rol => {
    expect(puedeVerHandover(rol, "empresa-a", "empresa-b")).toBe(false);
  });
  it("no habilita lectura sin empresa o sesión", () => {
    expect(puedeVerHandover("admin_org", null, "empresa-a")).toBe(false);
    expect(puedeVerHandover(null, "empresa-a", "empresa-a")).toBe(false);
  });
  it("no expone la ficha en el portal del cliente", () => {
    expect(puedeVerHandover("cliente", "empresa-a", "empresa-a")).toBe(false);
  });
});