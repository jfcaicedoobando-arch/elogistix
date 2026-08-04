/**
 * Tests para DraftRestoreBanner (P0 — v13.293.1).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DraftRestoreBanner } from "@/features/cotizacion/components/wizard/DraftRestoreBanner";

describe("DraftRestoreBanner", () => {
  it("muestra 'hace un momento' cuando el draft es reciente", () => {
    render(
      <DraftRestoreBanner
        savedAt={Date.now() - 5 * 1000}
        onRestore={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByText(/hace un momento/)).toBeInTheDocument();
  });

  it("muestra minutos entre 1 y 59", () => {
    render(
      <DraftRestoreBanner
        savedAt={Date.now() - 5 * 60 * 1000}
        onRestore={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByText(/hace 5 min/)).toBeInTheDocument();
  });

  it("muestra horas cuando ≥60 min y <24h", () => {
    render(
      <DraftRestoreBanner
        savedAt={Date.now() - 3 * 60 * 60 * 1000}
        onRestore={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.getByText(/hace 3 h/)).toBeInTheDocument();
  });

  it("dispara los callbacks", () => {
    const onRestore = vi.fn();
    const onDiscard = vi.fn();
    render(
      <DraftRestoreBanner savedAt={Date.now()} onRestore={onRestore} onDiscard={onDiscard} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Restaurar/i }));
    fireEvent.click(screen.getByRole("button", { name: /Descartar/i }));
    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
