/**
 * Las filas de higiene deben poder accionarse con teclado (Enter/Espacio),
 * además del click, y exponerse como enlaces para lectores de pantalla.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

import HigieneTabla from "../HigieneTabla";
import type { HigieneOportunidad } from "@/features/crm/services/higiene";

const fila: HigieneOportunidad = {
  id: "op-1",
  nombre: "Contenedor Shanghái",
  cliente_nombre: "ACME",
  etapa_id: "et-1",
  etapa_nombre: "Propuesta",
  vendedor_email: "ana@acme.mx",
  monto_estimado: 1000,
  moneda: "MXN",
  probabilidad: 50,
  fecha_estimada_cierre: null,
  ultimo_movimiento_at: "2026-09-01T10:00:00Z",
  dias_sin_movimiento: 4,
  sla_dias: 7,
  estado_higiene: "ok" as HigieneOportunidad["estado_higiene"],
  registro_completo: true,
  proxima_actividad_at: null,
  actividad_vencida: false,
};

function renderTabla() {
  render(
    <MemoryRouter>
      <HigieneTabla filas={[fila]} />
    </MemoryRouter>,
  );
  return screen.getByRole("link", { name: /Contenedor Shanghái/ });
}

describe("HigieneTabla · accesibilidad de filas", () => {
  beforeEach(() => navigate.mockReset());

  it("expone la fila como enlace enfocable", () => {
    const row = renderTabla();
    expect(row.getAttribute("tabindex")).toBe("0");
  });

  it("navega con Enter", () => {
    const row = renderTabla();
    fireEvent.keyDown(row, { key: "Enter" });
    expect(navigate).toHaveBeenCalledWith("/crm/oportunidades/op-1");
  });

  it("navega con Espacio", () => {
    const row = renderTabla();
    fireEvent.keyDown(row, { key: " " });
    expect(navigate).toHaveBeenCalledWith("/crm/oportunidades/op-1");
  });

  it("conserva la navegación por click", () => {
    const row = renderTabla();
    fireEvent.click(row);
    expect(navigate).toHaveBeenCalledWith("/crm/oportunidades/op-1");
  });
});
