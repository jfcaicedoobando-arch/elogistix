import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { createWrapper } from "@/test/utils/queryWrapper";
import { queryKeys } from "@/lib/query";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/features/configuracion/services", () => ({
  fetchConfiguracion: vi.fn(), updateConfiguracionByCategoriaClave: save,
}));
vi.mock("@/hooks/shared/useOrgActiva", () => ({ useOrgActiva: () => ({ organizationId: "org-sintetica" }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));
import { useUpdateConfiguracion } from "../useConfiguracion";

describe("guardar configuración invalida todos los consumidores de emisor", () => {
  it.each([false, true])("invalida vistas y previews, incluso con guardado parcial fallido=%s", async (failure) => {
    save.mockReset();
    if (failure) save.mockRejectedValue(new Error("Una clave no se guardó"));
    else save.mockResolvedValue(undefined);
    const { result } = renderHook(() => ({ mutation: useUpdateConfiguracion(), client: useQueryClient() }), { wrapper: createWrapper() });
    const invalidate = vi.spyOn(result.current.client, "invalidateQueries");
    const keys = [queryKeys.configuracion.all, queryKeys.facturacion.emisorEmpresa];
    await act(async () => {
      const write = result.current.mutation.mutateAsync([{ categoria: "empresa", clave: "nombre", valor: "Nombre nuevo" }]);
      if (failure) await expect(write).rejects.toThrow("Una clave");
      else await write;
    });
    for (const key of keys) expect(invalidate).toHaveBeenCalledWith({ queryKey: key });
  });
});
