/**
 * Factory tipada para construir objetos `CotizacionRow` en tests sin recurrir a `as any`.
 *
 * Uso:
 *   const c = makeCotizacionRow({ es_prospecto: true, prospecto_empresa: "ACME" });
 *
 * El `as unknown as CotizacionRow` está aislado aquí (un solo punto, marcado SAFE-CAST)
 * para que los tests consuman el objeto ya tipado sin escapar el sistema de tipos.
 */
import type { CotizacionRow } from "@/features/cotizacion/types";

const BASE_COTIZACION_ROW = {
  id: "cot-test-1",
  folio: "COT-TEST-0001",
  cliente_id: "cli-test",
  cliente_nombre: "Cliente Test",
  es_prospecto: false,
  prospecto_empresa: null,
  prospecto_contacto: null,
  prospecto_email: null,
  prospecto_telefono: null,
  modo: "Marítimo",
  tipo: "FCL",
  tipo_embarque: "FCL",
  tipo_contenedor: null,
  incoterm: "FOB",
  origen: "MXZLO",
  destino: "USLAX",
  descripcion_mercancia: "Mercancía de prueba",
  peso_kg: 1000,
  volumen_m3: 10,
  piezas: 1,
  subtotal: 1000,
  iva: 160,
  total: 1160,
  moneda: "USD",
  tipo_cambio_usd: 17.5,
  estado: "Borrador",
  vigencia_dias: 15,
  vigencia_desde: "2026-01-01",
  vigencia_hasta: "2026-01-16",
  notas: "",
  operador: "operador-test",
  conceptos_venta: [],
  dimensiones_lcl: [],
  dimensiones_aereas: [],
  organization_id: "org-test",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  tipo_documento: "cotizacion",
};

export function makeCotizacionRow(overrides: Partial<CotizacionRow> = {}): CotizacionRow {
  // SAFE-CAST: factory de testing; el base parcial cubre los campos accedidos por las
  // secciones de PDF y los overrides añaden lo específico de cada test. Centralizar
  // el cast aquí evita esparcir `as any` por 8 archivos de test.
  return { ...BASE_COTIZACION_ROW, ...overrides } as unknown as CotizacionRow;
}
