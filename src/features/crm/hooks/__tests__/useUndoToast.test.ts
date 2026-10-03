import { describe, it, expect, vi, beforeEach } from "vitest";

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { info: toastMock } }));

import { showUndoToast } from "../useUndoToast";
import { resetToastDedupeState } from "@/lib/ui/appFeedback.dedupe";

describe("showUndoToast", () => {
  beforeEach(() => { vi.clearAllMocks(); resetToastDedupeState(); });

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

  it("dos movimientos rápidos actualizan Deshacer con la última oportunidad", () => {
    const undoPrimero = vi.fn();
    const undoSegundo = vi.fn();
    showUndoToast("Etapa actualizada", undoPrimero);
    showUndoToast("Etapa actualizada", undoSegundo);
    expect(toastMock).toHaveBeenCalledTimes(2);
    const [primero, segundo] = toastMock.mock.calls.map(([, options]) => options);
    expect(segundo.id).toBe(primero.id);
    expect(segundo.cancel).toBeUndefined();
    segundo.action.onClick();
    expect(undoSegundo).toHaveBeenCalledTimes(1);
    expect(undoPrimero).not.toHaveBeenCalled();
  });
});
