/**
 * v13.823.346 — Espejo UI de `ROLES_ESCRITURA_COTIZACIONES` (edge function de
 * envío) y de `archivar_version_cotizacion`. Finanzas puede LEER el detalle,
 * pero no debe ver "Enviar por correo" ni "Re-cotizar".
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

/**
 * v13.823.355 (YAGNI r2 · P1) — regresión estática: la edición general de
 * cotizaciones (wizard y acciones de captura) se gatea con
 * `canWriteCotizaciones` (ventas/operación, igual que la RLS
 * `puede_escribir_cotizaciones`). Con `canEdit` (que incluye finanzas)
 * contador/tesorero entraban al wizard y el guardado fallaba con 42501.
 */
describe("gate de edición de cotizaciones", () => {
  const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), "utf8");

  it("EditarCotizacion usa canWriteCotizaciones", () => {
    const src = leer("src/features/cotizacion/routes/EditarCotizacion.tsx");
    expect(src).toContain("canWriteCotizaciones");
    expect(src).not.toMatch(/!canEdit\b/);
  });

  it("el detalle gatea las acciones de captura con canWriteCotizaciones", () => {
    const src = leer("src/features/cotizacion/components/detalle/CotizacionDetalleContenido.tsx");
    expect(src).toContain("{canWriteCotizaciones && (");
    expect(src).toContain("canEdit={canWriteCotizaciones}");
  });
});
