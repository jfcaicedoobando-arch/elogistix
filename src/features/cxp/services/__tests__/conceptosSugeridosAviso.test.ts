/**
 * RNF-09 (Ola 11) — Las sugerencias de conceptos del buzón ya no fallan en
 * silencio: un reintento + aviso en pantalla y `false` al caller.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const inserts: unknown[][] = [];
let respuestas: Array<{ error: unknown }> = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: (filas: unknown[]) => {
        inserts.push(filas);
        return Promise.resolve(respuestas.shift() ?? { error: null });
      },
    }),
  },
}));

const notifyWarning = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning: (...a: unknown[]) => notifyWarning(...a) }));
vi.mock("@/services/observability/logClientError", () => ({ logClientError: vi.fn() }));

const { guardarConceptosSugeridos } = await import("../facturasEntrantesConceptos");

const input = {
  organizationId: "org-1",
  conceptosSugeridos: [{ conceptoId: "c1", monto: 100 }],
};

describe("guardarConceptosSugeridos", () => {
  beforeEach(() => {
    inserts.length = 0;
    respuestas = [];
    notifyWarning.mockClear();
  });

  it("sin sugerencias no consulta la base y devuelve true", async () => {
    await expect(
      guardarConceptosSugeridos("e1", { organizationId: "org-1", conceptosSugeridos: [] }),
    ).resolves.toBe(true);
    expect(inserts).toHaveLength(0);
  });

  it("reintenta una vez y devuelve true si el segundo insert funciona", async () => {
    respuestas = [{ error: { message: "red caída" } }, { error: null }];
    await expect(guardarConceptosSugeridos("e1", input)).resolves.toBe(true);
    expect(inserts).toHaveLength(2);
    expect(notifyWarning).not.toHaveBeenCalled();
  });

  it("avisa una vez y devuelve false si ambos intentos fallan", async () => {
    respuestas = [{ error: { message: "boom" } }, { error: { message: "boom" } }];
    await expect(guardarConceptosSugeridos("e1", input)).resolves.toBe(false);
    expect(notifyWarning).toHaveBeenCalledTimes(1);
  });
});
