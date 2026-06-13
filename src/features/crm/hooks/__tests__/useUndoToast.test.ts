import { describe, it, expect, vi, beforeEach } from "vitest";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: toastMock }));

import { showUndoToast } from "../useUndoToast";

describe("showUndoToast", () => {
  beforeEach(() => vi.clearAllMocks());

  it("llama a toast con el mensaje y acción Deshacer", () => {
    const undo = vi.fn();
    showUndoToast("Lead eliminado", undo);
    expect(toastMock).toHaveBeenCalledWith(
      "Lead eliminado",
      expect.objectContaining({
        duration: 5000,
        action: expect.objectContaining({ label: "Deshacer" }),
      }),
    );
  });

  it("el onClick de la acción invoca undo", () => {
    const undo = vi.fn().mockResolvedValue(undefined);
    showUndoToast("Eliminado", undo);
    const { action } = toastMock.mock.calls[0][1] as { action: { onClick: () => void } };
    action.onClick();
    expect(undo).toHaveBeenCalledTimes(1);
  });
});
