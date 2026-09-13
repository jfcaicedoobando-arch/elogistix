/**
 * v13.823.346 — Espejo UI de `ROLES_ESCRITURA_COTIZACIONES` (edge function de
 * envío) y de `archivar_version_cotizacion`. Finanzas puede LEER el detalle,
 * pero no debe ver "Enviar por correo" ni "Re-cotizar".
 */
import { describe, it, expect } from "vitest";
import { puedeEscribirCotizaciones } from "@/features/cotizacion/domain/cotizacion";
import { visibilidadAcciones } from "@/features/cotizacion/domain/cotizacionDetalleAccionesVisibilidad";

describe("puedeEscribirCotizaciones", () => {
  it.each(["contador", "auxiliar_contable", "tesorero", "viewer", "cliente"] as const)(
    "%s NO puede enviar ni re-cotizar",
    (rol) => {
      expect(puedeEscribirCotizaciones(rol)).toBe(false);
    },
  );

  it.each(["vendedor", "gerente_comercial", "admin_org", "operador"] as const)(
    "%s sí puede enviar y re-cotizar",
    (rol) => {
      expect(puedeEscribirCotizaciones(rol)).toBe(true);
    },
  );

  it("sin rol no puede", () => {
    expect(puedeEscribirCotizaciones(null)).toBe(false);
  });
});

const base = {
  estado: "Aceptada",
  esProspecto: false,
  tieneEmbarquesVinculados: false,
  puedeAceptar: false,
  puedeRechazar: false,
  puedeAltaCliente: false,
  tieneOportunidad: false,
  tieneVenta: true,
  puedeCrearEmbarque: false,
};

describe("visibilidadAcciones — Re-cotizar por permiso", () => {
  it("oculta Re-cotizar a finanzas", () => {
    expect(visibilidadAcciones({ ...base, puedeRecotizar: false }).mostrarRecotizar).toBe(false);
  });

  it("muestra Re-cotizar a un rol de escritura", () => {
    expect(visibilidadAcciones({ ...base, puedeRecotizar: true }).mostrarRecotizar).toBe(true);
  });
});
