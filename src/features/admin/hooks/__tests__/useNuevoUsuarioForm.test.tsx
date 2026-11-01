import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PASSWORD_MIN } from "@/lib/passwords/policy";
import { DEFAULT_ROLE, useNuevoUsuarioForm } from "../useNuevoUsuarioForm";

describe("useNuevoUsuarioForm", () => {
  it("arranca con invitación y valores vacíos sin errores ni captura", () => {
    const { result } = renderHook(() => useNuevoUsuarioForm());
    expect(result.current).toMatchObject({
      email: "", password: "", role: DEFAULT_ROLE, orgId: "",
      porInvitacion: true, showPassword: false, isDirty: false,
      touched: { email: false, password: false },
      emailError: null, passwordError: null,
    });
  });

  it("muestra el correo inválido después de blur y lo revalida al editar", async () => {
    const { result } = renderHook(() => useNuevoUsuarioForm());
    act(() => result.current.setEmail("correo-invalido"));
    expect(result.current.emailError).toBeNull();
    act(() => result.current.setTouched((t) => ({ ...t, email: true })));
    await waitFor(() => expect(result.current.emailError).toBe("Correo no válido"));
    act(() => result.current.setEmail(" PERSONA@EMPRESA.COM "));
    await waitFor(() => expect(result.current.emailError).toBeNull());
    expect(result.current.touched).toEqual({ email: true, password: false });
  });

  it("valida la contraseña temporal después de blur y limpia el error al corregir", async () => {
    const { result } = renderHook(() => useNuevoUsuarioForm());
    act(() => {
      result.current.setPorInvitacion(false);
      result.current.setPassword("corta");
    });
    expect(result.current.passwordError).toBeNull();
    act(() => result.current.setTouched((t) => ({ ...t, password: true })));
    await waitFor(() => expect(result.current.passwordError).toBe(`Mínimo ${PASSWORD_MIN} caracteres`));
    act(() => result.current.setPassword("TemporalSegura123"));
    await waitFor(() => expect(result.current.passwordError).toBeNull());
  });

  it("revertir todos los campos vuelve a dejar el formulario limpio", () => {
    const { result } = renderHook(() => useNuevoUsuarioForm());
    act(() => {
      result.current.setEmail("persona@empresa.com");
      result.current.setPassword("TemporalSegura123");
      result.current.setRole("admin_org");
      result.current.setOrgId("org-1");
      result.current.setPorInvitacion(false);
    });
    expect(result.current.isDirty).toBe(true);
    act(() => {
      result.current.setEmail("");
      result.current.setPassword("");
      result.current.setRole(DEFAULT_ROLE);
      result.current.setOrgId("");
      result.current.setPorInvitacion(true);
    });
    expect(result.current.isDirty).toBe(false);
    act(() => result.current.setEmail("   "));
    expect(result.current.isDirty).toBe(false);
    act(() => result.current.setShowPassword(true));
    expect(result.current.isDirty).toBe(false);
  });

  it("reset limpia valores, errores, campos visitados y visibilidad de contraseña", async () => {
    const { result } = renderHook(() => useNuevoUsuarioForm());
    act(() => {
      result.current.setEmail("incorrecto");
      result.current.setPassword("corta");
      result.current.setPorInvitacion(false);
      result.current.setRole("admin_org");
      result.current.setOrgId("org-1");
      result.current.setShowPassword(true);
      result.current.setTouched({ email: true, password: true });
    });
    await waitFor(() => expect(result.current.emailError).toBe("Correo no válido"));
    act(() => result.current.reset());
    await waitFor(() => expect(result.current).toMatchObject({
      email: "", password: "", role: DEFAULT_ROLE, orgId: "",
      porInvitacion: true, showPassword: false, isDirty: false,
      touched: { email: false, password: false },
      emailError: null, passwordError: null,
    }));
    act(() => result.current.setEmail("otro-invalido"));
    expect(result.current.emailError).toBeNull();
  });

  it("los setters funcionales leen el último valor incluso en un mismo evento", () => {
    const { result } = renderHook(() => useNuevoUsuarioForm());
    const passwordPrefix = "a".repeat(PASSWORD_MIN);
    const passwordSuffix = "b".repeat(2);
    act(() => {
      result.current.setEmail((value) => `${value}persona`);
      result.current.setEmail((value) => `${value}@empresa.com`);
      result.current.setPassword((value) => `${value}${passwordPrefix}`);
      result.current.setPassword((value) => `${value}${passwordSuffix}`);
      result.current.setRole((value) => value === DEFAULT_ROLE ? "admin_org" : DEFAULT_ROLE);
      result.current.setOrgId((value) => `${value}org-1`);
      result.current.setPorInvitacion((value) => !value);
    });
    expect(result.current).toMatchObject({
      email: "persona@empresa.com", password: `${passwordPrefix}${passwordSuffix}`,
      role: "admin_org", orgId: "org-1", porInvitacion: false, isDirty: true,
    });
  });

  it("desmarcar touched conserva los valores y dirty sin desmarcar el otro campo", async () => {
    const { result } = renderHook(() => useNuevoUsuarioForm());
    await act(async () => {
      result.current.setEmail("incorrecto");
      result.current.setPassword("corta");
      result.current.setPorInvitacion(false);
      result.current.setTouched({ email: true, password: true });
    });
    expect(result.current.emailError).toBe("Correo no válido");
    expect(result.current.passwordError).toBe(`Mínimo ${PASSWORD_MIN} caracteres`);

    await act(async () => result.current.setTouched((value) => ({ ...value, email: false })));
    expect(result.current).toMatchObject({
      email: "incorrecto", password: "corta", porInvitacion: false, isDirty: true,
      touched: { email: false, password: true }, emailError: null,
      passwordError: `Mínimo ${PASSWORD_MIN} caracteres`,
    });
    await act(async () => result.current.setTouched((value) => ({ ...value, password: false })));
    expect(result.current).toMatchObject({
      email: "incorrecto", password: "corta", porInvitacion: false, isDirty: true,
      touched: { email: false, password: false }, emailError: null, passwordError: null,
    });

    await act(async () => result.current.setTouched({ email: true, password: true }));
    expect(result.current.emailError).toBe("Correo no válido");
    expect(result.current.passwordError).toBe(`Mínimo ${PASSWORD_MIN} caracteres`);
  });
});
