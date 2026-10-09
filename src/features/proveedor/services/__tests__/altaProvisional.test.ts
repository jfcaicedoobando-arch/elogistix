import { describe, it, expect, vi } from "vitest";
import { Constants } from "@/integrations/supabase/types";
import { puedeAprobarProveedor } from "../altaProvisional";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

describe("aprobación de proveedores provisionales", () => {
  it.each(["contador", "admin", "admin_org"])("%s puede aprobar", (rol) => {
    expect(puedeAprobarProveedor(rol)).toBe(true);
  });
  const sinPermiso = [
    ...Constants.public.Enums.app_role.filter(
      (rol) => rol !== "admin" && rol !== "contador" && rol !== "admin_org",
    ),
    null,
    undefined,
  ];
  it.each(sinPermiso)("%s no puede aprobar", (rol) => {
    expect(puedeAprobarProveedor(rol)).toBe(false);
  });
});
