/**
 * B-023 · Validación de formato RFC (SAT) en `rfcSchema`.
 * B-025 · Validación de dígito verificador CLABE en `preparePayload`.
 * Ambos validadores son puros y no tocan Supabase; los tests corren en jsdom estándar.
 */
import { describe, expect, it } from "vitest";
import { clienteInsertSchema } from "@/lib/validation/mutationSchemas";
import { preparePayload } from "@/features/proveedor/hooks/useNuevoProveedorController.helpers";
import type { NuevoProveedorForm } from "@/features/proveedor/hooks/useNuevoProveedorController.constants";

const baseCliente = { nombre: "Acme S.A. de C.V." };

describe("rfcSchema (B-023)", () => {
  it.each([
    ["XAXX010101000", "persona física de 13 chars"],
    ["ABC010203XYZ", "persona moral de 12 chars"],
    ["", "vacío se permite (campo opcional)"],
  ])("acepta %s (%s)", (rfc) => {
    const res = clienteInsertSchema.safeParse({ ...baseCliente, rfc });
    expect(res.success).toBe(true);
  });

  it.each([
    ["XA", "muy corto"],
    ["1234567890123", "empieza con dígitos"],
    ["XAXX010101ZZ", "sólo 12 chars pero sin patrón moral"],
    ["XAX-010101-000", "con guiones"],
  ])("rechaza %s (%s)", (rfc) => {
    const res = clienteInsertSchema.safeParse({ ...baseCliente, rfc });
    expect(res.success).toBe(false);
  });

  it("normaliza a mayúsculas antes de validar", () => {
    const res = clienteInsertSchema.safeParse({ ...baseCliente, rfc: "xaxx010101000" });
    expect(res.success).toBe(true);
  });
});

const baseProv: NuevoProveedorForm = {
  nombre: "Prov Test",
  tipo: "Naviera",
  origen_proveedor: "Nacional",
  rfc: "",
  contacto: "",
  telefono: "",
  email: "",
  moneda_preferida: "MXN",
  pais: "México",
  categoria: "Logistico",
  subtipo_gasto: null,
  cp: "",
  direccion: "",
  ciudad: "",
  estado: "",
  regimen_fiscal: "",
  banco: "",
  clabe: "",
  banco_pais: "",
  swift_bic: "",
  iban: "",
  aba_routing: "",
  banco_direccion: "",
  banco_intermediario: "",
  banco_intermediario_swift: "",
  beneficiario: "",
  referencia_pago: "",
} as unknown as NuevoProveedorForm;

describe("CLABE dígito verificador (B-025)", () => {
  it("acepta CLABE con dígito verificador correcto (DV=9 calculado con pesos 3-7-1)", () => {
    const clabeValida = "002180057800110029";
    const res = preparePayload({ ...baseProv, clabe: clabeValida });
    expect(res.ok).toBe(true);
  });

  it("rechaza CLABE con dígito verificador inválido", () => {
    // DV correcto es 9; usar 0 fuerza rechazo.
    const res = preparePayload({ ...baseProv, clabe: "002180057800110020" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.motivo).toBe("clabe");
  });


  it("rechaza CLABE con menos de 18 dígitos (regex previo)", () => {
    const res = preparePayload({ ...baseProv, clabe: "12345" });
    expect(res.ok).toBe(false);
  });

  it("permite CLABE vacía (opcional)", () => {
    const res = preparePayload({ ...baseProv, clabe: "" });
    expect(res.ok).toBe(true);
  });
});
