import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EnlaceTrackingCopiadoDialog } from "../EnlaceTrackingCopiadoDialog";

describe("aviso del enlace público copiado", () => {
  it("muestra la caducidad del enlace real, su alcance y cómo revocarlo", () => {
    const onClose = vi.fn();
    render(<EnlaceTrackingCopiadoDialog aviso={{ expiresAt: "2030-01-15T18:20:45Z" }} onClose={onClose} />);
    const dialog = screen.getByRole("dialog", { name: "Enlace público copiado" });
    expect(dialog).toHaveTextContent("Quien tenga este enlace");
    expect(dialog).toHaveTextContent("No permite descargar los archivos del expediente ni consultar notas internas");
    expect(dialog.querySelector("time")).toHaveAttribute("datetime", "2030-01-15T18:20:45Z");
    expect(dialog).toHaveTextContent("15/01/2030, 12:20:45");
    expect(dialog).toHaveTextContent("hora de Ciudad de México");
    expect(dialog).toHaveTextContent("conserva su fecha de vencimiento");
    expect(dialog).toHaveTextContent("Revocar este enlace");
    fireEvent.click(screen.getByRole("button", { name: "Entendido" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([null, "dato-invalido"])("no inventa una vigencia cuando expiresAt es %s", (expiresAt) => {
    render(<EnlaceTrackingCopiadoDialog aviso={{ expiresAt }} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Vencimiento no disponible");
    expect(document.querySelector("time")).toBeNull();
    expect(screen.queryByText(/30 días/)).not.toBeInTheDocument();
  });

  it("no anuncia una copia antes de recibir el resultado exitoso", () => {
    render(<EnlaceTrackingCopiadoDialog aviso={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
