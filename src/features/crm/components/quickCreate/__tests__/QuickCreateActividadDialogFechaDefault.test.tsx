/**
 * Regresión: el default de fecha se recalcula en cada apertura (false → true)
 * cuando el usuario no capturó fecha, y NO se sobrescribe si sí la editó.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import QuickCreateActividadDialog from "../QuickCreateActividadDialog";

const mocks = vi.hoisted(() => ({
  defaultFecha: vi.fn(() => "2026-09-04T17:00"),
}));

vi.mock("@/features/crm/domain/actividadDefaultFecha", () => ({
  actividadDefaultFechaMx: mocks.defaultFecha,
}));

vi.mock("@/features/crm/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/crm/hooks")>()),
  useOportunidades: () => ({ data: { data: [{ id: "op-1", nombre: "Proyecto X" }] } }),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "u@test.local" } }),
}));

function inputFecha(): HTMLInputElement {
  const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
  const encontrado = inputs.find((i) => /\d{2}\/\d{2}\/\d{4}/.test(i.value));
  expect(encontrado).toBeTruthy();
  return encontrado as HTMLInputElement;
}

describe("QuickCreateActividadDialog · default de fecha por apertura", () => {
  beforeEach(() => {
    mocks.defaultFecha.mockReset();
    mocks.defaultFecha.mockReturnValue("2026-09-04T17:00");
  });

  it("recalcula el default al abrir tras un cambio de día", () => {
    const { rerender } = render(
      <QuickCreateActividadDialog open={false} onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    // El reloj avanza al día siguiente mientras el menú permanece montado.
    mocks.defaultFecha.mockReturnValue("2026-09-05T17:00");
    rerender(
      <QuickCreateActividadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={vi.fn()} />,
    );
    expect(inputFecha().value).toContain("05/09/2026");
  });

  it("no sobrescribe una fecha capturada por el usuario", () => {
    const { rerender } = render(
      <QuickCreateActividadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={vi.fn()} />,
      { wrapper: createWrapper() },
    );
    const input = inputFecha();
    fireEvent.change(input, { target: { value: "20/09/2026 10:30" } });
    fireEvent.blur(input);
    expect(inputFecha().value).toContain("20/09/2026");

    // Un re-render con `open` ya en true no debe tocar la captura.
    mocks.defaultFecha.mockReturnValue("2026-09-05T17:00");
    rerender(
      <QuickCreateActividadDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} onMore={vi.fn()} />,
    );
    expect(inputFecha().value).toContain("20/09/2026");
  });
});
