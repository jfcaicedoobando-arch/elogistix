/**
 * 13.117.0 — Test del wrapper de bitácora para tarifas sugeridas.
 * Antes: 0 tests. Si la firma de `insertBitacora` cambia o se rompe el
 * mapeo de `ranking` → `entidadNombre`, perdemos auditoría sin avisar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertBitacoraMock = vi.fn();
vi.mock("@/features/auditoria/services/bitacora", () => ({
  insertBitacora: (...args: unknown[]) => insertBitacoraMock(...args),
}));

const getUserMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: () => getUserMock() } },
}));

import { logTarifaSugeridaAplicada } from "../bitacoraTarifa";

describe("logTarifaSugeridaAplicada", () => {
  beforeEach(() => {
    insertBitacoraMock.mockReset().mockResolvedValue(undefined);
    getUserMock.mockReset();
  });

  it("no-op si no hay usuario autenticado (no inserta bitácora huérfana)", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await logTarifaSugeridaAplicada({ tarifaId: "t1", ranking: 1 });
    expect(insertBitacoraMock).not.toHaveBeenCalled();
  });

  it("payload completo cuando hay cotización vinculada", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    await logTarifaSugeridaAplicada({ tarifaId: "t1", ranking: 2, cotizacionId: "c1" });

    expect(insertBitacoraMock).toHaveBeenCalledTimes(1);
    const payload = insertBitacoraMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      usuarioId: "u1",
      usuarioEmail: "a@b.com",
      accion: "tarifa_sugerida_aplicada",
      modulo: "cotizaciones",
      entidadId: "c1", // cotización tiene prioridad sobre tarifaId
      entidadNombre: "Top 2",
    });
    expect(payload.detalles).toMatchObject({
      tarifa_id: "t1",
      ranking: 2,
      cotizacion_id: "c1",
      borrador: false,
    });
  });

  it("usa tarifaId como entidadId cuando NO hay cotización (borrador)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    await logTarifaSugeridaAplicada({ tarifaId: "t9", ranking: 3 });

    const payload = insertBitacoraMock.mock.calls[0][0];
    expect(payload.entidadId).toBe("t9");
    expect(payload.entidadNombre).toBe("Top 3");
    expect(payload.detalles.borrador).toBe(true);
    expect(payload.detalles.cotizacion_id).toBeNull();
  });

  it("best-effort: si insertBitacora lanza, NO propaga (no rompe el flujo de aplicación)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    insertBitacoraMock.mockRejectedValue(new Error("DB down"));
    // No debe lanzar.
    await expect(
      logTarifaSugeridaAplicada({ tarifaId: "t1", ranking: 1 }),
    ).resolves.toBeUndefined();
  });

  it("email vacío si user.email es undefined (no truena por concat)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    await logTarifaSugeridaAplicada({ tarifaId: "t1", ranking: 1 });
    expect(insertBitacoraMock.mock.calls[0][0].usuarioEmail).toBe("");
  });
});
