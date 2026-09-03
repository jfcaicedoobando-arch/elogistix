import { describe, it, expect } from "vitest";
import {
  validarClienteConversion,
  conversionClienteValida,
} from "../validarClienteConversion";
import { EMPTY_CLIENTE_FORM, type ClienteFormData } from "@/features/cliente/types/clienteForm";

const COMPLETO: ClienteFormData = {
  ...EMPTY_CLIENTE_FORM,
  nombre: "Prospecto SA de CV",
  contacto: "Ana Ruiz",
  email: "ana@prospecto.mx",
  telefono: "5555555555",
  rfc: "PSA010101AA1",
  direccion: "Av. Reforma 1",
  ciudad: "CDMX",
  estado: "CDMX",
  cp: "06600",
  regimen_fiscal: "601",
};

describe("validarClienteConversion", () => {
  it("acepta un formulario completo", () => {
    expect(validarClienteConversion(COMPLETO)).toEqual({});
    expect(conversionClienteValida(COMPLETO)).toBe(true);
  });

  it("exige los campos fiscales del SAT", () => {
    const errores = validarClienteConversion({ ...EMPTY_CLIENTE_FORM });
    expect(Object.keys(errores)).toEqual(
      expect.arrayContaining(["nombre", "contacto", "email", "telefono", "rfc", "cp", "regimen_fiscal"]),
    );
  });

  it("exige dirección cuando el RFC es real", () => {
    expect(validarClienteConversion({ ...COMPLETO, direccion: "" }).direccion).toBeTruthy();
  });

  it("no exige dirección con RFC genérico", () => {
    const errores = validarClienteConversion({
      ...COMPLETO,
      rfc: "XAXX010101000",
      direccion: "",
    });
    expect(errores.direccion).toBeUndefined();
  });

  it("valida formato de correo, CP y RFC", () => {
    expect(validarClienteConversion({ ...COMPLETO, email: "ana(at)mail" }).email).toBeTruthy();
    expect(validarClienteConversion({ ...COMPLETO, cp: "660" }).cp).toBeTruthy();
    expect(validarClienteConversion({ ...COMPLETO, rfc: "XX1" }).rfc).toBeTruthy();
  });

  it("marca faltantes de uso CFDI, forma y método de pago", () => {
    const errores = validarClienteConversion({
      ...COMPLETO,
      uso_cfdi_default: "",
      forma_pago_default: "",
      metodo_pago_default: "",
    });
    expect(errores.uso_cfdi_default).toBeTruthy();
    expect(errores.forma_pago_default).toBeTruthy();
    expect(errores.metodo_pago_default).toBeTruthy();
  });
});
