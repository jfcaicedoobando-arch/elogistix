import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { errorCoherenciaEstricta, MSG_TARIFA_NO_VERIFICABLE } from "../resolverPuertosTarifa";
import { MSG_ORIGEN_INCOHERENTE } from "@/features/cotizacion/domain/coherenciaRutaTarifa";
import { queryKeys } from "@/lib/query";

const qc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const base = {
  modo: "Marítimo", tarifaId: "tar-1", origen: "Ningbo, CN", destino: "Manzanillo, MX",
  puertoOrigenId: "p-ngb", puertoDestinoId: "p-zlo",
};
const tarifa = { puerto_origen_id: "p-ngb", puerto_destino_id: "p-zlo" };

describe("P1-1 · coherencia fail-closed en cache miss", () => {
  it("cache miss: consulta la tarifa y detecta IDs incoherentes", async () => {
    const fetcher = vi.fn().mockResolvedValue(tarifa);
    const err = await errorCoherenciaEstricta(qc(), { ...base, puertoOrigenId: "p-sha" }, fetcher);
    expect(fetcher).toHaveBeenCalledWith("tar-1");
    expect(err).toBe(MSG_ORIGEN_INCOHERENTE);
  });
  it("cache miss coherente: pasa", async () => {
    expect(await errorCoherenciaEstricta(qc(), base, vi.fn().mockResolvedValue(tarifa))).toBeNull();
  });
  it("fallo de consulta o tarifa inexistente: bloquea", async () => {
    expect(await errorCoherenciaEstricta(qc(), base, vi.fn().mockRejectedValue(new Error("red")))).toBe(MSG_TARIFA_NO_VERIFICABLE);
    expect(await errorCoherenciaEstricta(qc(), base, vi.fn().mockResolvedValue(null))).toBe(MSG_TARIFA_NO_VERIFICABLE);
  });
  it("cache hit: no vuelve a consultar", async () => {
    const c = qc();
    c.setQueryData(queryKeys.cotizaciones.tarifaVinculada("tar-1"), tarifa);
    const fetcher = vi.fn();
    expect(await errorCoherenciaEstricta(c, base, fetcher)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("sin tarifa o no marítimo: no aplica", async () => {
    const fetcher = vi.fn();
    expect(await errorCoherenciaEstricta(qc(), { ...base, tarifaId: null }, fetcher)).toBeNull();
    expect(await errorCoherenciaEstricta(qc(), { ...base, modo: "Aéreo" }, fetcher)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
