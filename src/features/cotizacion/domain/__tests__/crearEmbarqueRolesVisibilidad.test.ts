/**
 * COT-2026-0245 (v13.823.306) — el administrador de la empresa (`admin_org`) y
 * los roles de operación deben ver el botón "Crear embarque" en una cotización
 * aceptada con venta positiva. Espejo de `public.crear_embarque_borrador_core`.
 */
import { describe, it, expect } from "vitest";
import { CREAR_EMBARQUE_BORRADOR } from "@/lib/access/permissionMatrix";
import { visibilidadAcciones } from "@/features/cotizacion/domain/cotizacionDetalleAccionesVisibilidad";
import type { AppRole } from "@/types/appRole";

const AUTORIZADOS: AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
  "coordinador_logistico",
  "operador",
];

const base = {
  estado: "Aceptada" as const,
  esProspecto: false,
  tieneEmbarquesVinculados: false,
  total: 4823,
};

describe("CREAR_EMBARQUE_BORRADOR", () => {
  it("incluye administración de la empresa y operación", () => {
    for (const rol of AUTORIZADOS) {
      expect(CREAR_EMBARQUE_BORRADOR).toContain(rol);
    }
  });

  it("no autoriza roles fuera de administración/operación", () => {
    for (const rol of ["vendedor", "contador", "cliente", "viewer"] as AppRole[]) {
      expect(CREAR_EMBARQUE_BORRADOR).not.toContain(rol);
    }
  });

  it("muestra el botón para cada rol autorizado con venta positiva", () => {
    for (const rol of AUTORIZADOS) {
      expect(visibilidadAcciones({ ...base, rol }).mostrarCrearEmbarque).toBe(true);
    }
  });

  it("oculta el botón para un rol sin permiso", () => {
    expect(visibilidadAcciones({ ...base, rol: "vendedor" }).mostrarCrearEmbarque).toBe(false);
  });
});
