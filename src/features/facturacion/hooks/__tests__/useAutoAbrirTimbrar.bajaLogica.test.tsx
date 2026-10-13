import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { deriveFacturaFlags } from "../../domain/facturaFlags";
import { useAutoAbrirTimbrar } from "../useAutoAbrirTimbrar";

const abrir = vi.fn();
function Entry({ deleted_at, puedeEmitir = true }: { deleted_at?: string | null; puedeEmitir?: boolean }) {
  const flags = deriveFacturaFlags({ estado: "Borrador", deleted_at, fecha_emision: "2026-10-03" }, true);
  useAutoAbrirTimbrar(flags.puedeTimbrarDesdeSistema, puedeEmitir, abrir);
  return <output>{useLocation().search}</output>;
}

describe("entrada ?accion=timbrar conserva el guard de vigencia", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["2026-10-10T10:00:00Z", undefined])("baja o vigencia desconocida (%s) no abre", (deleted_at) => {
    render(<MemoryRouter initialEntries={["/facturacion/f1?accion=timbrar&tab=cobros"]}><Entry deleted_at={deleted_at} /></MemoryRouter>);
    expect(abrir).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("?tab=cobros");
  });
  it("vigente con permiso abre una vez y consume la acción", () => {
    render(<MemoryRouter initialEntries={["/facturacion/f1?accion=timbrar"]}><Entry deleted_at={null} /></MemoryRouter>);
    expect(abrir).toHaveBeenCalledOnce();
    expect(screen.getByRole("status").textContent).toBe("");
  });
  it("vigencia no concede el permiso de emitir", () => {
    render(<MemoryRouter initialEntries={["/facturacion/f1?accion=timbrar"]}><Entry deleted_at={null} puedeEmitir={false} /></MemoryRouter>);
    expect(abrir).not.toHaveBeenCalled();
  });
});
