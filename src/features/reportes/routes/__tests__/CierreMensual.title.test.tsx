import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { buildDocumentTitle } from "@/hooks/shared/useDocumentTitle";
import CierreMensual from "../CierreMensual";

vi.mock("@/features/facturacion/components/TabProyeccion", () => ({ TabProyeccion: () => <div>Proyección</div> }));

describe("Cierre mensual: título de pestaña", () => {
  it("sustituye el título heredado de login al navegar y respeta el título de una ruta posterior", () => {
    document.title = buildDocumentTitle("Iniciar sesión");
    const { unmount } = render(<CierreMensual />);
    expect(screen.getByRole("heading", { name: "Cierre mensual" })).toBeInTheDocument();
    expect(document.title).toBe(buildDocumentTitle("Cierre mensual"));
    document.title = buildDocumentTitle("Cartera y antigüedad");
    unmount();
    expect(document.title).toBe(buildDocumentTitle("Cartera y antigüedad"));
  });
});
