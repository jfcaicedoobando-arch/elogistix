import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CosteoAgentesTable, type AgenteRow } from "../CosteoAgentesTable";

const viewport = vi.hoisted(() => ({ mobile: true }));
vi.mock("@/hooks/shared", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useIsMobile: () => viewport.mobile,
}));

const agente: AgenteRow = {
  id: "agente-1",
  nombre: "agencia prueba",
  proveedor_id: "proveedor-1",
  pais: "México",
  dias_credito: 15,
  contacto_tarifario: "Ana López",
  email: "ana@example.com",
  activo: true,
};

function setup(mobile = true) {
  viewport.mobile = mobile;
  const acciones = { editar: vi.fn(), invitar: vi.fn(), eliminar: vi.fn() };
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 691 });
  render(
    <MemoryRouter>
      <CosteoAgentesTable
        agentes={[agente]}
        isLoading={false}
        onEditar={acciones.editar}
        onInvitarPortal={acciones.invitar}
        onEliminar={acciones.eliminar}
      />
    </MemoryRouter>,
  );
  return acciones;
}

describe("CosteoAgentesTable móvil", () => {
  it("evita botones anidados y conserva edición por tarjeta", () => {
    const acciones = setup();
    const tarjeta = screen.getByRole("button", { name: "Editar agencia prueba" });
    const menu = screen.getByRole("button", { name: "Acciones para agencia prueba" });

    expect(tarjeta.tagName).toBe("DIV");
    expect(menu.closest("button button")).toBeNull();
    fireEvent.click(tarjeta);
    expect(acciones.editar).toHaveBeenCalledWith(agente);
    tarjeta.focus();
    fireEvent.keyDown(tarjeta, { key: "Enter" });
    expect(acciones.editar).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["Editar", "editar", agente],
    ["Invitar al portal", "invitar", agente],
    ["Eliminar", "eliminar", { id: agente.id, nombre: agente.nombre }],
  ] as const)("expone la acción %s", (etiqueta, callback, argumento) => {
    const acciones = setup();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Acciones para agencia prueba" }));
    fireEvent.click(screen.getByRole("menuitem", { name: etiqueta }));
    expect(acciones[callback]).toHaveBeenCalledWith(argumento);
  });

  it("edita por clic de fila sólo en escritorio y el menú no dispara ese clic", () => {
    const acciones = setup(false);
    const fila = screen.getByText("Agencia Prueba").closest("tr");
    expect(fila).not.toBeNull();
    fireEvent.click(fila as HTMLElement);
    expect(acciones.editar).toHaveBeenCalledWith(agente);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Acciones para agencia prueba" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Invitar al portal" }));
    expect(acciones.editar).toHaveBeenCalledTimes(1);
    expect(acciones.invitar).toHaveBeenCalledWith(agente);
  });
});