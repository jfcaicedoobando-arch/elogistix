import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PackageX } from "lucide-react";
import { DetailNotFound } from "@/components/shared/DetailNotFound";

function renderNotFound() {
  return render(
    <MemoryRouter>
      <DetailNotFound
        icon={PackageX}
        title="Embarque no encontrado"
        description="El embarque no existe."
        backTo="/embarques"
        backLabel="Volver a Embarques"
        withContainer={false}
      />
    </MemoryRouter>,
  );
}

describe("DetailNotFound", () => {
  it("muestra el encabezado con título y botón Volver del header", () => {
    renderNotFound();
    expect(screen.getByRole("heading", { name: "Embarque no encontrado" })).toBeInTheDocument();
    // v13.497.0: el botón del encabezado usa `useVolver` y se pinta como enlace
    // real con la ruta de respaldo, igual que el CTA del estado vacío.
    const salidas = screen.getAllByText(/volver a embarques/i);
    expect(salidas.length).toBeGreaterThanOrEqual(2);
    const enlaces = screen.getAllByRole("link", { name: /volver a embarques/i });
    expect(enlaces.length).toBeGreaterThanOrEqual(2);
    enlaces.forEach((el) => expect(el).toHaveAttribute("href", "/embarques"));

  });

  it("muestra la descripción del estado vacío", () => {
    renderNotFound();
    expect(screen.getByText("El embarque no existe.")).toBeInTheDocument();
  });
});
