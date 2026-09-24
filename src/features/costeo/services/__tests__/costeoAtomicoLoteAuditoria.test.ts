/** P1-5 / P1-6 / P2-1 — operaciones atómicas de costeo y alta de naviera. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const single = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: vi.fn(() => ({ insert: () => ({ select: () => ({ single: () => single() }) }) })),
  },
}));
const registrarActividad = vi.fn();
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: (...a: unknown[]) => registrarActividad(...a) }));

import { insertTarifaConRecargos, MSG_TARIFA_DUPLICADA } from "../tarifas/mutations";
import { replaceDemorasTramos } from "../navieraCondiciones";
import { insertNaviera } from "@/features/catalogos/services/navieras";
import { queryKeys } from "@/lib/query";

const input = {
  agente_id: "ag", naviera_id: "nv", ruta_id: "ru", tipo_contenedor_id: "tc",
  flete_base: 3200, dias_libres_demoras: 14, vigente_desde: "2026-09-01", vigente_hasta: "2026-09-30",
  recargos: [{ concepto: "BAF", monto: 150 }, { concepto: " ", monto: 10 }],
};

beforeEach(() => vi.clearAllMocks());

describe("P1-6 · alta de tarifa con recargos", () => {
  it("una sola RPC con los recargos válidos", async () => {
    rpc.mockResolvedValue({ data: { id: "t1" }, error: null });
    const t = await insertTarifaConRecargos("org-mty", input);
    expect(t.id).toBe("t1");
    expect(rpc).toHaveBeenCalledTimes(1);
    const [nombre, args] = rpc.mock.calls[0];
    expect(nombre).toBe("crear_tarifa_con_recargos_rpc");
    expect(args.p_recargos).toHaveLength(1);
  });
  it("si falla (rollback en BD) no registra bitácora y traduce duplicado", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "dup" } });
    await expect(insertTarifaConRecargos("org-mty", input)).rejects.toThrow(MSG_TARIFA_DUPLICADA);
    expect(registrarActividad).not.toHaveBeenCalled();
  });
});

describe("P1-5 · reemplazo de tramos de demoras", () => {
  const tramos = [{ tipo_contenedor_id: "tc", desde_dia: 1, hasta_dia: 5, monto_por_dia: 80, moneda: "USD" }];
  it("éxito: una sola RPC transaccional", async () => {
    rpc.mockResolvedValue({ data: 1, error: null });
    await replaceDemorasTramos("cond", "tc", tramos);
    expect(rpc).toHaveBeenCalledWith("reemplazar_demoras_tramos_rpc", expect.objectContaining({ p_naviera_condicion_id: "cond" }));
    expect(registrarActividad).toHaveBeenCalledTimes(1);
  });
  it("fallo de inserción: propaga error sin borrar aparte ni registrar", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "insert falló" } });
    await expect(replaceDemorasTramos("cond", "tc", tramos)).rejects.toThrow("insert falló");
    expect(registrarActividad).not.toHaveBeenCalled();
  });
});

describe("P2-1 / P2-2 · alta de naviera", () => {
  it("devuelve el id creado", async () => {
    single.mockResolvedValue({ data: { id: "nv-new" }, error: null });
    await expect(insertNaviera({ code: "HLCU", name: "Hapag" })).resolves.toEqual({ id: "nv-new" });
  });
  it("la key del catálogo de Costeo cuelga de navieras.all (se invalida al crear)", () => {
    const all = queryKeys.navieras.all;
    expect(queryKeys.costeo.navieras.catalogo().slice(0, all.length)).toEqual([...all]);
  });
});
