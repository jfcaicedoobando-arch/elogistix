// Fixtures locales del barrido; el borrado conserva UUID y estado.
import type { FilaFactura } from "../satBarrido.ts";

export interface Fixture extends FilaFactura {
  organization_id: string;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
  uuid_estatus_sat: string | null;
  uuid_verificado_fecha: string | null;
  uuid_verificado: boolean;
  proveedores: { origen_proveedor: string };
}

export const ORG = "org-local";
export const DELETED_AT = "2026-10-10T00:00:00.000Z";

export function factura(id: string, overrides: Partial<Fixture> = {}): Fixture {
  return {
    id,
    organization_id: ORG,
    uuid_fiscal: "11111111-1111-4111-8111-111111111111",
    rfc_proveedor: "AAA010101AAA",
    total: 100,
    folio_interno: `F-${id}`,
    folio_proveedor: `P-${id}`,
    proveedor_nombre: "Proveedor local",
    estado: "Vigente",
    deleted_at: null,
    deleted_by: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    uuid_estatus_sat: null,
    uuid_verificado_fecha: null,
    uuid_verificado: false,
    proveedores: { origen_proveedor: "Nacional" },
    ...overrides,
  };
}

export function fixturesSeleccion(): Fixture[] {
  return [
    factura("activa-nunca-vigente", { created_at: "2026-10-05T00:00:00.000Z" }),
    factura("borrada-vigente", {
      deleted_at: DELETED_AT,
      deleted_by: "usuario-local",
      updated_at: DELETED_AT,
      created_at: "2026-10-12T00:00:00.000Z",
    }),
    factura("activa-verificada-pagada", {
      estado: "Pagada",
      uuid_estatus_sat: "Vigente",
      uuid_verificado: true,
      uuid_verificado_fecha: "2026-10-02T00:00:00.000Z",
      created_at: "2026-10-04T00:00:00.000Z",
    }),
    factura("borrada-pagada", {
      estado: "Pagada",
      deleted_at: DELETED_AT,
      deleted_by: "usuario-local",
      updated_at: DELETED_AT,
      uuid_estatus_sat: "Vigente",
      uuid_verificado: true,
      uuid_verificado_fecha: "2026-09-01T00:00:00.000Z",
      created_at: "2026-10-11T00:00:00.000Z",
    }),
    factura("activa-nunca-pagada", {
      estado: "Pagada",
      created_at: "2026-10-06T00:00:00.000Z",
    }),
    factura("otra-organizacion", {
      organization_id: "org-ajena",
      created_at: "2026-10-13T00:00:00.000Z",
    }),
    factura("uuid-nulo", { uuid_fiscal: null, created_at: "2026-10-13T00:00:00.000Z" }),
    factura("extranjera", {
      proveedores: { origen_proveedor: "Extranjero" },
      created_at: "2026-10-13T00:00:00.000Z",
    }),
    factura("activa-otro-estado", {
      estado: "Cancelada",
      uuid_estatus_sat: "Vigente",
      uuid_verificado_fecha: "2026-08-01T00:00:00.000Z",
      created_at: "2026-10-03T00:00:00.000Z",
    }),
    factura("activa-verificada-reciente", {
      uuid_estatus_sat: "Vigente",
      uuid_verificado_fecha: "2026-10-04T00:00:00.000Z",
      created_at: "2026-10-07T00:00:00.000Z",
    }),
    factura("activa-nunca-tercera", { created_at: "2026-10-02T00:00:00.000Z" }),
  ];
}

export function fixturePorId(fixtures: Fixture[], id: string): Fixture {
  const row = fixtures.find((fixture) => fixture.id === id);
  if (row === undefined) throw new Error(`No existe la fixture: ${id}`);
  return row;
}
