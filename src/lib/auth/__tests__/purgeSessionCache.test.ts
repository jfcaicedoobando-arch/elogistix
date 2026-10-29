/** EC-01 — Purga de caché al cambiar de sesión. */
import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { purgeSessionCache, debePurgarPorCambioDeUsuario } from "@/lib/auth/purgeSessionCache";

describe("purgeSessionCache", () => {
  it("limpia todo el caché de React Query", () => {
    const clear = vi.fn();
    purgeSessionCache({ clear } as unknown as Parameters<typeof purgeSessionCache>[0]);
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("los listeners de removed observan el caché de mutaciones ya vacío durante la purga", async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { gcTime: Infinity, retry: false } },
    });
    const cache = client.getMutationCache();
    const mutation = cache.build(client, {
      mutationKey: ["session-write"],
      mutationFn: async () => ({ organizationId: "org-outgoing", total: 42 }),
    });
    await mutation.execute(undefined);

    const snapshots: unknown[][] = [];
    const unsubscribe = cache.subscribe((event) => {
      if (event.type === "removed") {
        snapshots.push(cache.getAll().map((entry) => entry.state.data));
      }
    });
    try {
      purgeSessionCache(client);
      expect(snapshots).toEqual([[]]);
      expect(cache.getAll()).toEqual([]);
    } finally {
      unsubscribe();
      client.clear();
    }
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
