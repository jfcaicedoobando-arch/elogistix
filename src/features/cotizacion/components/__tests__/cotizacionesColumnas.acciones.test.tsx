/**
 * v13.823.350 — Duplicar y Eliminar deben ser espejo de sus RPC:
 * `duplicar_cotizacion` sólo acepta admin/operador/ejecutivo_pricing y
 * `soft_delete_record` sólo super_admin/admin/operador. Con la capacidad amplia
 * de escritura, ventas (vendedor, gerente comercial, customer service) veía las
 * dos acciones y la RPC respondía 42501.
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/shared";
import { buildCotizacionesColumns } from "@/features/cotizacion/components/cotizacionesColumns";

vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: vi.fn() }));

import { useAuth } from "@/lib/contexts/AuthContext";
const mockUseAuth = vi.mocked(useAuth);
type Auth = ReturnType<typeof useAuth>;

function permisos(rol: string) {
  mockUseAuth.mockReturnValue({ role: rol, effectiveRole: rol } as Partial<Auth> as Auth);
  return renderHook(() => usePermissions()).result.current;
}

describe("permisos de duplicar/eliminar cotización", () => {
  it.each(["vendedor", "customer_service", "gerente_comercial"])(
    "%s escribe cotizaciones pero NO duplica ni elimina",
    (rol) => {
      const p = permisos(rol);
      expect(p.canWriteCotizaciones).toBe(true);
      expect(p.canDuplicateCotizacion).toBe(false);
      expect(p.canDeleteCotizacion).toBe(false);
    },
  );

  it("operador duplica y elimina", () => {
    const p = permisos("operador");
    expect(p.canDuplicateCotizacion).toBe(true);
    expect(p.canDeleteCotizacion).toBe(true);
  });

  it("ejecutivo_pricing duplica pero NO elimina", () => {
    const p = permisos("ejecutivo_pricing");
    expect(p.canDuplicateCotizacion).toBe(true);
    expect(p.canDeleteCotizacion).toBe(false);
  });

  it.each(["contador", "tesorero"])("%s no duplica ni elimina", (rol) => {
    const p = permisos(rol);
    expect(p.canDuplicateCotizacion).toBe(false);
    expect(p.canDeleteCotizacion).toBe(false);
  });
});

async function etiquetasAcciones(canDuplicar: boolean, canEliminar: boolean): Promise<string[]> {
  const cols = buildCotizacionesColumns({
    canDuplicar,
    canEliminar,
    onEliminar: () => {},
    onDuplicar: () => {},
  });
  const acciones = cols.find((c) => c.id === "actions");
  if (!acciones?.cell || typeof acciones.cell !== "function") return [];
  // SAFE-CAST: la celda de acciones sólo consume `row.original`.
  const ctx = { row: { original: { id: "c1" } } } as unknown as Parameters<typeof acciones.cell>[0];
  render(<>{acciones.cell(ctx) as ReactNode}</>);
  fireEvent.pointerDown(
    screen.getByRole("button", { name: "Acciones" }),
    new MouseEvent("pointerdown", { bubbles: true, button: 0 }),
  );
  await waitFor(() => expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0));
  return screen.getAllByRole("menuitem").map((el) => el.textContent ?? "");
}

describe("buildCotizacionesColumns — columna de acciones", () => {
  it("sin duplicar ni eliminar no agrega la columna de acciones", () => {
    const cols = buildCotizacionesColumns({
      canDuplicar: false,
      canEliminar: false,
      onEliminar: () => {},
      onDuplicar: () => {},
    });
    expect(cols.some((c) => c.id === "actions")).toBe(false);
  });

  it("sólo duplicar no muestra Eliminar", async () => {
    expect(await etiquetasAcciones(true, false)).toEqual(["Duplicar"]);
  });

  it("sólo eliminar no muestra Duplicar", async () => {
    expect(await etiquetasAcciones(false, true)).toEqual(["Eliminar"]);
  });

  it("ambas capacidades muestran las dos acciones", async () => {
    expect(await etiquetasAcciones(true, true)).toEqual(["Duplicar", "Eliminar"]);
  });
});
