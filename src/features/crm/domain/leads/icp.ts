/**
 * Perfil ICP (Ideal Customer Profile) del lead — Etapa 1 de la migración del
 * CRM Hunter (Excel comercial) al ERP.
 *
 * Los campos viven en `public.crm_leads` y se heredan a la oportunidad al
 * convertir el lead.
 */

export const ICP_INCOTERMS = [
  "EXW", "FOB", "CIF", "CFR", "DAP", "DDP", "FCA", "CPT", "CIP", "N/A",
] as const;

export const ICP_FRECUENCIAS = [
  "Semanal", "Quincenal", "Mensual", "Bimestral", "Trimestral", "Esporádica",
] as const;

/**
 * Catálogo canónico de estatus ICP. `value` es EXACTAMENTE lo que se persiste
 * en `public.crm_leads.estatus_icp` (incluye `calificado`, que escribe la RPC
 * `crm_calificar_prospecto`); `label` es lo que ve el usuario.
 */
export const ICP_ESTATUS_OPCIONES = [
  { value: "Sin calificar", label: "Sin calificar" },
  { value: "calificado", label: "Calificado" },
  { value: "Validado", label: "Validado" },
  { value: "Nutrición", label: "Nutrición" },
  { value: "Descartado", label: "Descartado" },
] as const;

export const ICP_ESTATUS = ICP_ESTATUS_OPCIONES.map((o) => o.value);

/**
 * Normaliza un estatus histórico al valor canónico sin perder información:
 * compara sin acentos/mayúsculas contra valores y etiquetas conocidas y, si no
 * hay coincidencia, conserva el valor tal como está en la base.
 */
function plano(texto: string): string {
  return texto.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function normalizarEstatusIcp(raw: string | null | undefined): string {
  const valor = (raw ?? "").trim();
  if (valor === "") return "Sin calificar";
  const clave = plano(valor);
  const hit = ICP_ESTATUS_OPCIONES.find(
    (o) => plano(o.value) === clave || plano(o.label) === clave,
  );
  return hit ? hit.value : valor;
}

export function etiquetaEstatusIcp(raw: string | null | undefined): string {
  const valor = normalizarEstatusIcp(raw);
  return ICP_ESTATUS_OPCIONES.find((o) => o.value === valor)?.label ?? valor;
}

/** Opciones a mostrar, incluyendo el valor actual si es desconocido. */
export function opcionesEstatusIcp(
  actual: string | null | undefined,
): { value: string; label: string }[] {
  const base = ICP_ESTATUS_OPCIONES.map((o) => ({ value: o.value, label: o.label }));
  const valor = normalizarEstatusIcp(actual);
  if (!base.some((o) => o.value === valor)) base.push({ value: valor, label: valor });
  return base;
}


/** Campos ICP editables (todos texto libre salvo la fecha de nutrición). */
export interface LeadIcpForm {
  sector: string;
  sitio_web: string;
  anios_establecida: string;
  cargo_contacto: string;
  origen: string;
  destino: string;
  mercancia: string;
  rutas: string;
  aduana_puerto: string;
  incoterm: string;
  volumen: string;
  frecuencia: string;
  dolor_explicito: string;
  consecuencia: string;
  proveedor_actual: string;
  estatus_icp: string;
  motivo_nutricion: string;
  fecha_nutricion: string;
}

export const EMPTY_LEAD_ICP_FORM: LeadIcpForm = {
  sector: "",
  sitio_web: "",
  anios_establecida: "",
  cargo_contacto: "",
  origen: "",
  destino: "",
  mercancia: "",
  rutas: "",
  aduana_puerto: "",
  incoterm: "",
  volumen: "",
  frecuencia: "",
  dolor_explicito: "",
  consecuencia: "",
  proveedor_actual: "",
  estatus_icp: "Sin calificar",
  motivo_nutricion: "",
  fecha_nutricion: "",
};

export const LEAD_ICP_KEYS = Object.keys(EMPTY_LEAD_ICP_FORM) as (keyof LeadIcpForm)[];

/** Fuente persistida: cualquier objeto con las llaves ICP en versión nullable. */
export type LeadIcpSource = Partial<Record<keyof LeadIcpForm, string | number | null>>;

/** Normaliza la fila de BD al formulario (nulls → ""). */
export function toLeadIcpForm(row: LeadIcpSource | null | undefined): LeadIcpForm {
  if (!row) return { ...EMPTY_LEAD_ICP_FORM };
  const out = { ...EMPTY_LEAD_ICP_FORM };
  for (const key of LEAD_ICP_KEYS) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") out[key] = String(value);
  }
  return out;
}

/** Convierte el formulario a patch de BD ("" → null, años → número). */
export type LeadIcpPatch = {
  [K in Exclude<keyof LeadIcpForm, "anios_establecida">]: string | null;
} & { anios_establecida: number | null };

export function toLeadIcpPatch(form: LeadIcpForm): LeadIcpPatch {
  const patch = {} as LeadIcpPatch;
  for (const key of LEAD_ICP_KEYS) {
    const raw = form[key].trim();
    if (key === "anios_establecida") {
      patch[key] = raw === "" ? null : Number(raw);
      continue;
    }
    patch[key] = raw === "" ? null : raw;
  }
  return patch;
}

export function isLeadIcpDirty(row: LeadIcpSource | null | undefined, form: LeadIcpForm): boolean {
  const base = toLeadIcpForm(row);
  return LEAD_ICP_KEYS.some((key) => base[key] !== form[key]);
}

/**
 * Campos mínimos que el equipo comercial exige para declarar un ICP validado.
 * FUENTE ÚNICA: `etapas.ts` (gate Lead→Prospecto) y la RPC
 * `crm_calificar_prospecto` usan esta misma lista, para que "100% completo"
 * signifique exactamente "el gate ya pasa".
 */
export const CAMPOS_MINIMOS_ICP = [
  "sector", "mercancia", "rutas", "volumen", "frecuencia", "dolor_explicito",
  "proveedor_actual",
] as const satisfies readonly (keyof LeadIcpForm)[];

const CAMPOS_MINIMOS: readonly (keyof LeadIcpForm)[] = CAMPOS_MINIMOS_ICP;

/** % de completitud del perfil ICP (0 a 1) sobre los campos mínimos. */
export function completitudIcp(row: LeadIcpSource | null | undefined): number {
  const form = toLeadIcpForm(row);
  const llenos = CAMPOS_MINIMOS.filter((key) => form[key].trim() !== "").length;
  return llenos / CAMPOS_MINIMOS.length;
}
