import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
const fetchDetalle = vi.hoisted(() => vi.fn());
vi.mock("@/features/tesoreria/services/traspasoDetalle", () => ({ fetchTraspasoDetalle: fetchDetalle }));
import { useTraspasoDetalle } from "../useTraspasoDetalle";
function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}
beforeEach(() => { fetchDetalle.mockReset(); });
describe("Consulta del detalle de traspaso", () => {
  it("lee el ID solicitado y conserva errores para reintentar desde el panel", async () => {
    const error = new Error("sin acceso al traspaso");
    fetchDetalle.mockRejectedValue(error);
    const { result } = renderHook(() => useTraspasoDetalle("t41"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchDetalle).toHaveBeenCalledWith("t41");
    expect(result.current.error).toBe(error);
  });
  it("no consulta cuando falta el identificador", () => {
    const { result } = renderHook(() => useTraspasoDetalle(""), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchDetalle).not.toHaveBeenCalled();
  });
});
