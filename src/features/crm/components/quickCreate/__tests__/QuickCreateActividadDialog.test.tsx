/**
 * QuickCreateActividadDialog · v13.821.7 (P2-7): idem Lead/Oportunidad —
 * LC conocido vs desconocido en `getErrorMessage(e)`.
 *
 * Hallazgo #13.1 (auditoría CRM): el toast de error/éxito lo emite
 * `useCrearActividad` (una sola notificación por acción) — por eso el test
 * ya no mockea el hook completo, sino el servicio de I/O que usa, para
 * ejercitar el `onError` real del hook.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import QuickCreateActividadDialog from "../QuickCreateActividadDialog";

const mocks = vi.hoisted(() => ({
  crearActividad: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("@/features/crm/services/actividades", () => ({
  crearActividad: mocks.crearActividad,
}));

vi.mock("@/features/crm/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/crm/hooks")>()),
  useOportunidades: () => ({ data: { data: [{ id: "op-1", nombre: "Proyecto X" }] } }),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "u@test.local" } }),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: mocks.notifyError,
}));

async function crearActividad() {
  render(<QuickCreateActividadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={vi.fn()} />, {
    wrapper: createWrapper(),
  });
  fireEvent.change(screen.getByLabelText(/Asunto/), { target: { value: "Llamar a cliente" } });
  // Radix Select no responde a click en jsdom: se abre y elige con teclado.
  const trigger = screen.getByRole("combobox", { name: /Oportunidad/i });
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const opcion = await screen.findByRole("option", { name: "Proyecto X" });
  fireEvent.keyDown(opcion, { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "Crear" }));
  await waitFor(() => expect(mocks.notifyError).toHaveBeenCalled());
}

describe("QuickCreateActividadDialog · mensajes de error", () => {
  beforeEach(() => {
    mocks.crearActividad.mockReset();
    mocks.notifyError.mockReset();
  });

  it("traduce un código LC conocido a su mensaje amigable", async () => {
    mocks.crearActividad.mockRejectedValue(new Error("LC_OPORTUNIDAD_INEXISTENTE"));
    await crearActividad();
    expect(mocks.notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        description: "La oportunidad ya no existe o pertenece a otra organización.",
      }),
    );
  });

  it("deja pasar el mensaje crudo cuando el código LC es desconocido", async () => {
    mocks.crearActividad.mockRejectedValue(new Error("LC_CODIGO_INVENTADO_XYZ: detalle raro"));
    await crearActividad();
    expect(mocks.notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ description: "detalle raro" }),
    );
  });
});
