/**
 * v13.823.108 — notas de actividad:
 * si el guardado falla no se duplica el aviso de error
 * (useActualizarActividadNotas ya notifica en onError).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import ActividadNotasSheet from "@/features/crm/components/actividades/ActividadNotasSheet";

const mutateAsync = vi.fn(async (_input: Record<string, unknown>) => ({}));
const successToast = vi.fn();
const errorToast = vi.fn();

vi.mock("@/features/crm/hooks", () => ({
  useActualizarActividadNotas: () => ({ mutateAsync, isPending: false }),
}));

vi.mock("@/features/crm/lib/crmToast", () => ({
  crmToast: {
    success: (...args: unknown[]) => successToast(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const actividad = {
  id: "a1",
  asunto: "Llamada de seguimiento",
  resultado: "Pendiente",
} as unknown as import("@/features/crm/hooks").CrmActividadRow;

function guardar(onOpenChange = vi.fn()) {
  render(
    <ActividadNotasSheet actividad={actividad} open onOpenChange={onOpenChange} />,
    { wrapper: createWrapper() },
  );
  fireEvent.change(screen.getByPlaceholderText(/¿Qué pasó\?/), {
    target: { value: "Dejó mensaje" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Guardar/i }));
  return onOpenChange;
}

describe("ActividadNotasSheet", () => {
  beforeEach(() => {
    mutateAsync.mockClear();
    successToast.mockClear();
    errorToast.mockClear();
  });

  it("guarda, notifica éxito y cierra el Sheet", async () => {
    const onOpenChange = guardar();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({ id: "a1", resultado: "Dejó mensaje" });
    expect(successToast).toHaveBeenCalledWith("Notas guardadas");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(errorToast).not.toHaveBeenCalled();
  });

  it("notas: si falla no repite el aviso de error (el hook ya notifica)", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("RLS denegado"));
    const onOpenChange = guardar();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(errorToast).not.toHaveBeenCalled());
    expect(successToast).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
