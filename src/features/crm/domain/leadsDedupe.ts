/**
 * Normalización y clasificación de leads duplicados (v13.630.0 — Ola A CRM).
 * Módulo puro: espejo exacto de la lógica de la RPC
 * `crm_leads_buscar_duplicados` para poder decidir en cliente.
 */

export type NivelDuplicado = "nuevo" | "posible" | "exacto";

export interface LeadClave {
  empresa?: string | null;
  email?: string | null;
  telefono?: string | null;
}

export interface LeadExistente extends LeadClave {
  id: string;
  contacto?: string | null;
  estado?: string | null;
}

export interface Coincidencia {
  nivel: NivelDuplicado;
  /** Campos que coincidieron: "correo", "teléfono", "empresa". */
  campos: string[];
  existente?: LeadExistente;
}

const MIN_EMPRESA = 4;
const MIN_TEL = 8;

export function normEmpresa(v: string | null | undefined): string {
  return (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normEmail(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/** Sólo dígitos; se comparan los últimos 10 (lada nacional MX). */
export function normTelefono(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

function ultimos10(v: string): string {
  return v.slice(-10);
}

/** Clasifica una fila contra el catálogo de leads existentes. */
export function clasificarDuplicado(
  fila: LeadClave,
  existentes: ReadonlyArray<LeadExistente>,
): Coincidencia {
  const email = normEmail(fila.email);
  const tel = normTelefono(fila.telefono);
  const empresa = normEmpresa(fila.empresa);

  for (const ex of existentes) {
    const campos: string[] = [];
    if (email && normEmail(ex.email) === email) campos.push("correo");
    if (
      tel.length >= MIN_TEL &&
      normTelefono(ex.telefono).length >= MIN_TEL &&
      ultimos10(normTelefono(ex.telefono)) === ultimos10(tel)
    ) {
      campos.push("teléfono");
    }
    if (empresa.length >= MIN_EMPRESA && normEmpresa(ex.empresa) === empresa) {
      campos.push("empresa");
    }
    if (campos.length === 0) continue;
    // Correo igual (o empresa + teléfono) = mismo lead; una sola señal débil
    // se marca como "posible" para que el usuario decida.
    const exacto = campos.includes("correo") || campos.length >= 2;
    return { nivel: exacto ? "exacto" : "posible", campos, existente: ex };
  }
  return { nivel: "nuevo", campos: [] };
}

/** Detecta también duplicados internos del propio archivo CSV. */
export function clasificarLote<T extends LeadClave>(
  filas: ReadonlyArray<T>,
  existentes: ReadonlyArray<LeadExistente>,
): Coincidencia[] {
  const vistos: LeadExistente[] = [];
  return filas.map((f, i) => {
    const contraBd = clasificarDuplicado(f, existentes);
    if (contraBd.nivel !== "nuevo") return contraBd;
    const contraArchivo = clasificarDuplicado(f, vistos);
    vistos.push({ id: `csv-${i}`, ...f });
    if (contraArchivo.nivel === "nuevo") return contraArchivo;
    return { ...contraArchivo, campos: [...contraArchivo.campos, "repetido en el archivo"] };
  });
}

export function resumenDuplicados(cs: ReadonlyArray<Coincidencia>) {
  return {
    nuevos: cs.filter((c) => c.nivel === "nuevo").length,
    posibles: cs.filter((c) => c.nivel === "posible").length,
    exactos: cs.filter((c) => c.nivel === "exacto").length,
  };
}
