import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasoFacturaNueva } from "../PasoFacturaNueva";
const nueva = { id: "n", numero: "F2", estado: "Borrador", uuid_fiscal: null, cliente_nombre: "Destino", rfc_cliente: null, total: 10, moneda: "MXN", cancellation_status: null, deleted_at: null };
const props = { facturaNueva: null, estadoFacturaNueva: "sin_referencia" as const, clienteDestinoNombre: "Destino", duplicando: false, consultando: false, onDuplicar: vi.fn(), onIrABorrador: vi.fn(), onRefrescar: vi.fn(), consistencia: null, consistenciaCargando: false };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("paso nueva: referencia versus permiso para operar", () => {
  it.each(["ausente", "error", "verificando", "desconocida"] as const)("%s no ofrece crear por lectura vacía", (estadoFacturaNueva) => {
    render(<PasoFacturaNueva {...props} estadoFacturaNueva={estadoFacturaNueva} />);
    expect(screen.queryByRole("button", { name: "Crear borrador" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actualizar estado" })).toBeInTheDocument();
  });
  it("baja conserva evidencia y no ofrece timbrar", () => {
    render(<PasoFacturaNueva {...props} facturaNueva={{ ...nueva, deleted_at: "2026-10-13" }} estadoFacturaNueva="eliminada" />);
    expect(screen.getByText("F2")).toBeInTheDocument();
    expect(screen.getByText(/dada de baja/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Abrir y timbrar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Crear borrador/ })).not.toBeInTheDocument();
  });
  it("sólo una referencia vigente ofrece abrir", () => {
    const { rerender } = render(<PasoFacturaNueva {...props} facturaNueva={nueva} estadoFacturaNueva="vigente" />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir y timbrar" }));
    expect(props.onIrABorrador).toHaveBeenCalledOnce();
    rerender(<PasoFacturaNueva {...props} facturaNueva={nueva} estadoFacturaNueva="error" />);
    expect(screen.queryByRole("button", { name: "Abrir y timbrar" })).not.toBeInTheDocument();
  });
});
