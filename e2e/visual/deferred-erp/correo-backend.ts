import { useSyncExternalStore } from "react";

/** Synthetic state only. The production readers and paginator call this client. */
type Row = Record<string, unknown>;
export type CorreoScenario = "ready" | "conflict-late" | "error-conflicts" | "error-catalog" | "inactive-global" | "inactive-org";
export const CORREO_IDS = {
  orgA: "10000000-0000-4000-8000-000000000001", orgB: "10000000-0000-4000-8000-000000000002",
  origin: "20000000-0000-4000-8000-000000000001", destination: "20000000-0000-4000-8000-000000000002",
  agent: "30000000-0000-4000-8000-000000000001", carrier: "40000000-0000-4000-8000-000000000001",
  route: "50000000-0000-4000-8000-000000000001", preparedType: "60000000-0000-4000-8000-000000000001",
  legacyType: "60000000-0000-4000-8000-000000000002",
} as const;

interface Read { table: string; from: number; to: number; filters: [string, unknown][]; orders: string[]; count: number; error: string | null }
interface Write { kind: string; organizationId?: string; input: Row }
const listeners = new Set<() => void>();
let revision = 0;
let organizationId: string = CORREO_IDS.orgA;
let scenario: CorreoScenario = "ready";
let reads: Read[] = [];
let writes: Write[] = [];
let invocations: { name: string; organizationId: string }[] = [];
const notify = () => { revision += 1; listeners.forEach(listener => listener()); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); };

export function useOrganization() {
  return { organizationId: useSyncExternalStore(subscribe, () => organizationId, () => organizationId) };
}

export function useCorreoRevision() { return useSyncExternalStore(subscribe, () => revision, () => revision); }
export function setCorreoOrganization(value: string) {
  if (value !== CORREO_IDS.orgA && value !== CORREO_IDS.orgB) throw new Error("Unknown synthetic organization");
  organizationId = value; notify();
}
export function resetCorreo(value: CorreoScenario) {
  scenario = value; organizationId = CORREO_IDS.orgA; reads = []; writes = []; invocations = []; notify();
}
export function correoAudit() {
  return { scenario, organizationId, reads, writes, invocations, preparedType: CORREO_IDS.preparedType, legacyType: CORREO_IDS.legacyType };
}

function tableRows(table: string): Row[] {
  const bothOrganizations = (row: Row) => [CORREO_IDS.orgA, CORREO_IDS.orgB].map(org => ({ ...row, organization_id: org }));
  const inactive = scenario === "inactive-global";
  const origin = { id: CORREO_IDS.origin, name: "Shanghai", code: "CNSHA", country: "China", activo: !inactive };
  const destination = { id: CORREO_IDS.destination, name: "Manzanillo", code: "MXZLO", country: "Mexico", activo: true };
  const carrier = { id: CORREO_IDS.carrier, name: "Maersk sintética", code: "MAEU", activo: !inactive };
  const type = { id: CORREO_IDS.preparedType, name: "20 GP", code: "20GP", activo: !inactive, created_at: "2020-01-01" };
  const existing = { id: "70000000-0000-4000-8000-000000000001", agente_id: CORREO_IDS.agent,
    naviera_id: CORREO_IDS.carrier, ruta_id: CORREO_IDS.route, tipo_contenedor_id: CORREO_IDS.legacyType,
    flete_base: 900, vigente_desde: "2026-10-01", vigente_hasta: "2026-10-31", estado: "vigente", estado_aprobacion: "borrador" };
  switch (table) {
    case "puertos":
      return [...Array.from({ length: 1000 }, (_, i) => ({ id: `synthetic-port-${i}`, name: `Puerto sintético ${i}`, code: `P${i}`, country: "China", activo: true })), origin, destination];
    case "navieras": return [carrier];
    case "tipos_contenedor": return [type, { ...type, id: CORREO_IDS.legacyType, activo: false, created_at: "2010-01-01" }];
    case "costeo_agentes": return bothOrganizations({ id: CORREO_IDS.agent, nombre: "Longsail sintético" });
    case "costeo_rutas": return bothOrganizations({ id: CORREO_IDS.route, puerto_origen_id: CORREO_IDS.origin, puerto_destino_id: CORREO_IDS.destination });
    case "catalogo_org_desactivado": return scenario === "inactive-org"
      ? ["puertos", "navieras", "tipos_contenedor"].map((catalogo, i) => ({ catalogo, item_id: [CORREO_IDS.origin, CORREO_IDS.carrier, CORREO_IDS.preparedType][i], organization_id: CORREO_IDS.orgA })) : [];
    case "costeo_tarifas": {
      if (scenario !== "conflict-late" && scenario !== "error-conflicts") return [];
      const fillers = Array.from({ length: 1000 }, (_, i) => ({ ...existing, id: `synthetic-rate-${i}`, agente_id: "synthetic-other-agent", organization_id: CORREO_IDS.orgA }));
      return [...fillers, { ...existing, organization_id: CORREO_IDS.orgA }, { ...existing, id: "synthetic-other-tenant", organization_id: CORREO_IDS.orgB }];
    }
    default: throw new Error(`Unexpected correo table: ${table}`);
  }
}

function from(table: string) {
  let rows = tableRows(table);
  const filters: [string, unknown][] = [];
  const orders: string[] = [];
  const query = {
    select(_columns: string) { return query; },
    eq(column: string, value: unknown) { filters.push([column, value]); rows = rows.filter(row => row[column] === value); return query; },
    order(column: string) { orders.push(column); return query; },
    range(start: number, end: number) {
      const error = start === 1000 && ((scenario === "error-conflicts" && table === "costeo_tarifas") || (scenario === "error-catalog" && table === "puertos"))
        ? { message: "Fallo sintético en segunda página" } : null;
      const data = error ? null : rows.slice(start, end + 1);
      reads.push({ table, from: start, to: end, filters: [...filters], orders: [...orders], count: data?.length ?? 0, error: error?.message ?? null });
      notify();
      return Promise.resolve({ data, error });
    },
  };
  return query;
}

export const correoSupabase = {
  from,
  functions: {
    async invoke(name: string, options: { body: { organizationId: string } }) {
      if (name !== "extraer-tarifas-correo") throw new Error(`Unexpected synthetic function: ${name}`);
      if (![CORREO_IDS.orgA, CORREO_IDS.orgB].some(org => org === options.body.organizationId)) throw new Error("Unknown synthetic extraction scope");
      invocations.push({ name, organizationId: options.body.organizationId }); notify();
      // Inline invented mail: parser is real, Gmail is never consulted.
      return { data: { correos: [{ proveedor: "longsail", asunto: "Fixture ficticio PR372", fecha: "2026-10-17T12:00:00Z",
        textoPlano: "VALIDITY: From 17-Oct to 31-Oct\nSHANGHAIMANZANILLO1000000019-OctMSK21General cargo.", xlsxBase64: null, xlsxNombre: null }] }, error: null };
    },
  },
};

function assertTarifaWriteScope(org: string) {
  if ((scenario !== "ready" && scenario !== "conflict-late") || org !== organizationId ||
    (org !== CORREO_IDS.orgA && org !== CORREO_IDS.orgB) || writes.length !== 0 ||
    invocations[invocations.length - 1]?.organizationId !== org) {
    throw new Error("Unexpected synthetic tariff write scope or scenario");
  }
}

function assertTarifaPreparation(org: string) {
  const completedRead = reads.some(read => read.table === "costeo_tarifas" && read.error === null && read.count < 1000 &&
    read.filters.length === 1 && read.filters[0][0] === "organization_id" && read.filters[0][1] === org);
  if (!completedRead || reads.some(read => read.error !== null)) throw new Error("Synthetic tariff write requires complete successful preparation");
}

function assertTarifaPayload(input: Row) {
  const expected: Row = {
    agente_id: CORREO_IDS.agent, naviera_id: CORREO_IDS.carrier, ruta_id: CORREO_IDS.route,
    tipo_contenedor_id: CORREO_IDS.preparedType, flete_base: 1000, dias_libres_demoras: 21,
    vigente_desde: "2026-10-17", vigente_hasta: "2026-10-31", notas: "ETD 19-Oct. Naviera: MSK", recargos: [],
  };
  // TarifaInput has no currency/status/scope fields: adding moneda, estado,
  // estado_aprobacion, organization_id or any other unexpected property rejects.
  const keys = Object.keys(expected);
  if (!input || Object.getPrototypeOf(input) !== Object.prototype || Reflect.ownKeys(input).length !== keys.length ||
    keys.some(key => !Object.prototype.hasOwnProperty.call(input, key))) {
    throw new Error("Unexpected synthetic tariff payload properties");
  }
  for (const key of keys) {
    const valid = key === "recargos"
      ? Array.isArray(input.recargos) && input.recargos.length === 0 && Reflect.ownKeys(input.recargos).length === 1
      : input[key] === expected[key];
    if (!valid) throw new Error(`Unexpected synthetic tariff payload: ${key}`);
  }
}

function assertExpectedTarifa(org: string, input: Row) {
  assertTarifaWriteScope(org);
  assertTarifaPreparation(org);
  assertTarifaPayload(input);
}

export async function insertTarifaConRecargos(org: string, input: Row) {
  assertExpectedTarifa(org, input);
  writes.push({ kind: "tarifa", organizationId: org, input: structuredClone(input) }); notify(); return { id: "synthetic-created-rate" };
}
// Every scenario supplies its existing route and catalogs. No creation is allowed.
export async function insertCosteoRuta(_org: string, _input: Row): Promise<never> {
  throw new Error("Route creation is forbidden in the synthetic correo scenarios");
}
export async function insertPuerto(_input: Row): Promise<never> {
  throw new Error("Port creation is forbidden in the synthetic correo scenarios");
}
export async function insertNaviera(_input: Row): Promise<never> {
  throw new Error("Carrier creation is forbidden in the synthetic correo scenarios");
}
