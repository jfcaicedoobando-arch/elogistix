/** Strict in-memory Supabase substitute for PR373. It cannot access a backend. */
export const CRM_ACTIVE_COMPANY = { id: "fixture-empresa-activa", nombre: "Empresa vigente ficticia", deleted_at: null };
export const CRM_DELETED_COMPANY = {
  id: "fixture-empresa-eliminada", nombre: "Nombre histórico ficticio", deleted_at: "2026-10-16T10:00:00Z",
};

export const CRM_OWNERS = {
  contacto: {
    editable: "fixture-contacto-edicion", readonly: "fixture-contacto-lectura",
    noConfig: "fixture-contacto-sin-config", hidden: "fixture-contacto-oculto",
  },
  oportunidad: {
    editable: "fixture-oportunidad-edicion", readonly: "fixture-oportunidad-lectura",
    noConfig: "fixture-oportunidad-sin-config", hidden: "fixture-oportunidad-oculto",
  },
} as const;

type Filters = Record<string, unknown>;
interface Read { table: string; columns: string; filters: Filters; limit?: number }
interface Write { table: string; action: "delete-link"; filters: Filters }
const tables = new Set(["crm_empresa_contacto", "crm_oportunidad_empresa", "crm_empresas", "crm_contactos"]);
const owners = new Set<string>(Object.values(CRM_OWNERS).flatMap(group => Object.values(group)));
const editableOwners = new Set<string>([CRM_OWNERS.contacto.editable, CRM_OWNERS.oportunidad.editable]);
const listeners = new Set<() => void>();
let version = 0;
let reads: Read[] = [];
let writes: Write[] = [];
let blocked: string[] = [];
let removedLinks = new Map<string, Set<string>>();

function changed() { version += 1; listeners.forEach(listener => listener()); }
function forbidden(message: string): never {
  blocked.push(message);
  changed();
  throw new Error(`CRM fixture blocked: ${message}`);
}

export function resetCrmBackend() {
  reads = [];
  writes = [];
  blocked = [];
  removedLinks = new Map();
  changed();
}
export function subscribeCrmBackend(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getCrmBackendVersion() { return version; }
export function getCrmBackendState() { return structuredClone({ reads, writes, blocked }); }
export function isCrmFixtureTable(table: string) { return tables.has(table); }

class CrmQuery implements PromiseLike<{ data: unknown; error: null; count?: number }> {
  private columns = "";
  private filters: Filters = {};
  private rowLimit?: number;
  private action: "select" | "delete" = "select";
  constructor(private table: string) {}
  select(columns: string) { this.columns = columns; return this; }
  eq(column: string, value: unknown) { this.filters[column] = value; return this; }
  is(column: string, value: unknown) { this.filters[column] = value; return this; }
  limit(value: number) { this.rowLimit = value; return this; }
  order(column: string) { if (column !== "nombre") forbidden(`unexpected order ${column}`); return this; }
  range(from: number, to: number) { if (from !== 0 || to !== 24) forbidden("unexpected catalog page"); return this; }
  ilike(column: string, value: string) { this.filters[column] = value; return this; }
  or(value: string) { this.filters.or = value; return this; }
  delete() { this.action = "delete"; return this; }
  upsert(): never { return forbidden(`upsert ${this.table}`); }
  insert(): never { return forbidden(`insert ${this.table}`); }
  update(): never { return forbidden(`update ${this.table}`); }

  private execute() {
    if (this.table === "crm_empresas" || this.table === "crm_contactos") {
      return this.executeCatalog();
    }
    const ownerColumn = this.table === "crm_empresa_contacto" ? "contacto_id" : "oportunidad_id";
    const owner = this.filters[ownerColumn];
    if (typeof owner !== "string" || !owners.has(owner)) return forbidden("unknown fixture owner");
    return this.action === "delete" ? this.executeDelete(owner) : this.executeLinkedCompanies(owner);
  }

  private executeCatalog() {
    if (this.action !== "select") return forbidden(`catalog write ${this.table}`);
    if (this.filters.deleted_at !== null) return forbidden("catalog without active filter");
    reads.push({ table: this.table, columns: this.columns, filters: { ...this.filters } });
    changed();
    // The real picker hooks execute too. This scenario intentionally offers no additions.
    return { data: [], error: null, count: 0 };
  }

  private executeDelete(owner: string) {
    const company = this.filters.empresa_id;
    if (!editableOwners.has(owner) || Object.keys(this.filters).length !== 2 ||
      (company !== CRM_ACTIVE_COMPANY.id && company !== CRM_DELETED_COMPANY.id)) {
      return forbidden("delete outside the editable fixture links");
    }
    writes.push({ table: this.table, action: "delete-link", filters: { ...this.filters } });
    const removed = removedLinks.get(owner) ?? new Set<string>();
    removed.add(company);
    removedLinks.set(owner, removed);
    changed();
    return { data: null, error: null };
  }

  private executeLinkedCompanies(owner: string) {
    if (this.columns !== "crm_empresas(id, nombre, deleted_at)" || this.rowLimit !== 200 || Object.keys(this.filters).length !== 1) {
      return forbidden("unexpected linked-company projection");
    }
    reads.push({ table: this.table, columns: this.columns, filters: { ...this.filters }, limit: this.rowLimit });
    changed();
    const companies = owner.endsWith("-oculto") ? [] : [CRM_ACTIVE_COMPANY, CRM_DELETED_COMPANY];
    const visible = companies.filter(company => !removedLinks.get(owner)?.has(company.id));
    // A null embed is always present, including in editable cases; the real service must omit it.
    return { data: [...visible.map(company => ({ crm_empresas: { ...company } })), { crm_empresas: null }], error: null };
  }

  then<TResult1 = { data: unknown; error: null; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve().then(() => this.execute()).then(onfulfilled, onrejected);
  }
}

export const crmSupabase = {
  from(table: string) {
    if (!isCrmFixtureTable(table)) return forbidden(`unknown table ${table}`);
    return new CrmQuery(table);
  },
};
