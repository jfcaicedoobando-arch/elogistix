/**
 * v13.823.106 — comentarios de oportunidad:
 * si la publicación falla no se duplica el aviso de error
 * (useCrearComentarioOportunidad ya notifica en onError).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ComentariosOportunidad from "@/features/crm/components/ComentariosOportunidad";

const mutateAsync = vi.fn(async (_input: Record<string, unknown>) => ({}));
const notifyError = vi.fn();
const successToast = vi.fn();

vi.mock("@/features/crm/hooks", () => ({
  useComentariosOportunidad: () => ({ data: [], isLoading: false }),
  useCrearComentarioOportunidad: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
}));
vi.mock("@/features/crm/lib/crmToast", () => ({
  crmToast: { success: (...args: unknown[]) => successToast(...args) },
}));

function publicar() {
  fireEvent.change(screen.getByPlaceholderText(/Escribe una nota interna/i), {
    target: { value: "Nota interna" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Publicar/i }));
}

describe("ComentariosOportunidad", () => {
  beforeEach(() => {
    mutateAsync.mockClear();
    notifyError.mockClear();
    successToast.mockClear();
  });

  it("publica y muestra el éxito local", async () => {
    render(<ComentariosOportunidad oportunidadId="op1" canEdit />);
    publicar();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(successToast).toHaveBeenCalledWith("Comentario publicado");
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("comentarios: si falla no repite el aviso de error (el hook ya notifica)", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("RLS denegado"));
    render(<ComentariosOportunidad oportunidadId="op1" canEdit />);
    publicar();
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(notifyError).not.toHaveBeenCalled());
    expect(successToast).not.toHaveBeenCalled();
  });
});
