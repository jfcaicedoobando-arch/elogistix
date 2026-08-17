/** EC-01 — Purga de caché al cambiar de sesión. */
import { describe, it, expect, vi } from "vitest";
import { purgeSessionCache, debePurgarPorCambioDeUsuario } from "@/lib/auth/purgeSessionCache";

describe("purgeSessionCache", () => {
  it("limpia todo el caché de React Query", () => {
    const clear = vi.fn();
    purgeSessionCache({ clear } as unknown as Parameters<typeof purgeSessionCache>[0]);
    expect(clear).toHaveBeenCalledTimes(1);
  });
});

describe("debePurgarPorCambioDeUsuario", () => {
  it("purga cuando entra un usuario distinto", () => {
    expect(debePurgarPorCambioDeUsuario("SIGNED_IN", "u-1", "u-2")).toBe(true);
  });

  it("no purga en el primer login de la pestaña", () => {
    expect(debePurgarPorCambioDeUsuario("SIGNED_IN", null, "u-1")).toBe(false);
  });

  it("no purga si es el mismo usuario", () => {
    expect(debePurgarPorCambioDeUsuario("SIGNED_IN", "u-1", "u-1")).toBe(false);
  });

  it("no purga con otros eventos de auth", () => {
    expect(debePurgarPorCambioDeUsuario("TOKEN_REFRESHED", "u-1", "u-2")).toBe(false);
  });
});
