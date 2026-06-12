/**
 * Factories tipadas para tests (Fase 3 auditoría — 12.84.0).
 *
 * Reemplazo gradual de los ~75 `as any` en tests por builders tipados.
 * Cada factory devuelve un objeto válido con campos requeridos y permite
 * overrides parciales. Usar:
 *
 *   const cot = makeCotizacion({ cliente_nombre: "ACME" });
 *
 * Los tipos provienen de `@/integrations/supabase/types` para mantenerse
 * sincronizados con el schema real; si la BD evoluciona, los tests fallarán
 * en compilación (no en runtime).
 */
import type { Tables } from "@/integrations/supabase/types";

type Cliente = Tables<"clientes">;
type Cotizacion = Tables<"cotizaciones">;
type Embarque = Tables<"embarques">;
type Proforma = Tables<"proformas">;
type Factura = Tables<"facturas">;
type ProveedorFactura = Tables<"proveedor_facturas">;

const ORG = "00000000-0000-0000-0000-000000000001";
const NOW = "2026-06-12T00:00:00Z";

export function makeCliente(overrides: Partial<Cliente> = {}): Cliente {
  return {
    id: "cli-1",
    organization_id: ORG,
    nombre: "Cliente Demo SA",
    contacto: "Juan Pérez",
    email: "demo@cliente.mx",
    telefono: "5555555555",
    rfc: "DEMO010101AAA",
    direccion: "Calle 1",
    ciudad: "CDMX",
    estado: "CDMX",
    cp: "01000",
    pais: "México",
    activo: true,
    notas: null,
    dias_credito: 15,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  } as Cliente;
}

export function makeCotizacion(overrides: Partial<Cotizacion> = {}): Cotizacion {
  return {
    id: "cot-1",
    organization_id: ORG,
    cliente_id: "cli-1",
    cliente_nombre: "Cliente Demo SA",
    tipo_documento: "real",
    modo: "Marítimo",
    tipo: "Importación",
    incoterm: "FOB",
    estado: "Cotizada",
    es_prospecto: false,
    num_contenedores: 1,
    peso_kg: 1000,
    volumen_m3: 30,
    piezas: 100,
    tipo_carga: "FCL",
    tipo_contenedor: "40HC",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  } as unknown as Cotizacion;
}

export function makeEmbarque(overrides: Partial<Embarque> = {}): Embarque {
  return {
    id: "emb-1",
    organization_id: ORG,
    cliente_id: "cli-1",
    cliente_nombre: "Cliente Demo SA",
    expediente: "EXP-2026-0001",
    estado: "Confirmado",
    modo: "Marítimo",
    tipo: "Importación",
    incoterm: "FOB",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  } as unknown as Embarque;
}

export function makeProforma(overrides: Partial<Proforma> = {}): Proforma {
  return {
    id: "prof-1",
    organization_id: ORG,
    embarque_id: "emb-1",
    cliente_id: "cli-1",
    cliente_nombre: "Cliente Demo SA",
    expediente: "EXP-2026-0001",
    numero: "PROF-0001",
    fecha_emision: "2026-06-01",
    dias_credito: 15,
    subtotal_usd: 100,
    iva_usd: 16,
    total_usd: 116,
    subtotal_mxn: 0,
    iva_mxn: 0,
    total_mxn: 0,
    estado: "Borrador",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  } as unknown as Proforma;
}

export function makeFactura(overrides: Partial<Factura> = {}): Factura {
  return {
    id: "fac-1",
    organization_id: ORG,
    cliente_id: "cli-1",
    cliente_nombre: "Cliente Demo SA",
    embarque_id: "emb-1",
    proforma_id: "prof-1",
    numero: "A-100",
    fecha_emision: "2026-06-01",
    fecha_vencimiento: "2026-06-16",
    moneda: "MXN",
    subtotal: 1000,
    iva: 160,
    total: 1160,
    saldo: 1160,
    estado: "Pendiente",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  } as unknown as Factura;
}

export function makeProveedorFactura(overrides: Partial<ProveedorFactura> = {}): ProveedorFactura {
  return {
    id: "pf-1",
    organization_id: ORG,
    proveedor_id: "prov-1",
    proveedor_nombre: "Proveedor Demo",
    folio: "FX-100",
    fecha_emision: "2026-06-01",
    fecha_vencimiento: "2026-07-01",
    moneda: "MXN",
    subtotal: 1000,
    iva: 160,
    total: 1160,
    saldo: 1160,
    estado: "Pendiente",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  } as unknown as ProveedorFactura;
}

export const TEST_ORG_ID = ORG;
