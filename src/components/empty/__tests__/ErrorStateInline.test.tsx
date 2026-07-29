/**
 * Q-08 — Estado de error y empty-state son mutuamente excluyentes y la
 * acción primaria "Reintentar" ejecuta el refetch sin navegar.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorStateInline } from "../ErrorStateInline";

describe("ErrorStateInline", () => {
  it("muestra Reintentar y dispara onRetry sin navegar", () => {
    const onRetry = vi.fn();
    render(<ErrorStateInline message="Falló la red" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/");
  });

  it("no muestra empty-state: comunica error real", () => {
    render(<ErrorStateInline message="Falló la red" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/sin resultados/i)).not.toBeInTheDocument();
  });

  it("deshabilita el botón mientras reintenta", () => {
    render(<ErrorStateInline message="x" onRetry={vi.fn()} retrying />);
    expect(screen.getByRole("button", { name: /reintentando/i })).toBeDisabled();
  });
});
