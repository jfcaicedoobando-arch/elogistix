import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import { useDirtyGuard } from "../useDirtyGuard";
import { registerDirtyHistoryGuard } from "@/lib/bootstrap/dirtyHistoryGuard";

// Same bootstrap order as src/main.tsx, before BrowserRouter installs its listener.
registerDirtyHistoryGuard();

function Captura() {
  const [monto, setMonto] = useState("25");
  const { guardDialog } = useDirtyGuard(true, true);
  return <><input aria-label="Monto anticipo" value={monto} onChange={(e) => setMonto(e.target.value)} />{guardDialog}</>;
}

describe("Atrás del navegador con captura sin guardar", () => {
  it("restaura la entrada sin desmontar; continúa sólo al confirmar", async () => {
    window.history.replaceState({ idx: 0 }, "", "/anterior");
    window.history.pushState({ idx: 1 }, "", "/anticipo");
    render(<BrowserRouter><Routes>
      <Route path="/anticipo" element={<Captura />} />
      <Route path="/anterior" element={<p>Página anterior</p>} />
    </Routes></BrowserRouter>);
    window.history.back();
    await waitFor(() => expect(screen.getByRole("alertdialog")).toHaveTextContent("¿Salir sin guardar?"));
    expect(window.location.pathname).toBe("/anticipo");
    fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
    expect(screen.getByRole("textbox", { name: "Monto anticipo" })).toHaveValue("25");
    window.history.back();
    await waitFor(() => expect(screen.getByRole("button", { name: "Salir sin guardar" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Salir sin guardar" }));
    await waitFor(() => expect(screen.getByText("Página anterior")).toBeInTheDocument());
    expect(window.location.pathname).toBe("/anterior");
  });
});
