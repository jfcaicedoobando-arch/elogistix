import { expect, it, vi } from "vitest";
const notifyError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError, notifyInfo: vi.fn(), notifySuccess: vi.fn(), notifyWarning: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: (options: unknown) => options,
  useQuery: vi.fn(),
}));
vi.mock("../../services/demorasEmbarque", () => ({ calcularDemorasEmbarque: vi.fn(), contarDemorasAuto: vi.fn(), eliminarDemorasAuto: vi.fn() }));
import { useRecalcularDemoras } from "../useDemorasEmbarque";
it("audit147 · traduce el objeto PostgREST y explica que no cambió cargos", () => {
  const mutation = useRecalcularDemoras("emb") as unknown as { onError: (error: unknown) => void };
  mutation.onError({ message: "LC_DEMORAS_MONEDAS_MIXTAS: tabulador mixto", code: "P0001" });
  expect(notifyError).toHaveBeenCalledWith(undefined, expect.objectContaining({
    title: "No se calcularon las demoras",
    description: expect.stringContaining("los cargos anteriores se conservan"),
  }));
});
