/**
 * Bloque 3.1 — Mapeo de filas CSV → payload validable para mutaciones de
 * clientes y proveedores. Devuelve `{ valid, invalid }` para que la UI muestre
 * conteos y errores legibles antes de tocar la base.
 *
 * Las claves esperadas en el CSV son las columnas normalizadas por
 * `normalizeHeader` (lowercase + snake_case sin acentos). La plantilla que
 * descarga el usuario usa exactamente esos nombres.
 */
import { z } from "zod";
import type { TablesInsert } from "@/integrations/supabase/types";

type Row = Record<string, string>;

const optional = (s: string | undefined): string | null => {
  if (s === undefined) return null;
  const t = s.trim();
  return t === "" ? null : t;
};

// ── Cliente ───────────────────────────────────────────────────────────

export const CLIENTE_TEMPLATE_HEADERS = [
  "nombre",
  "rfc",
  "email",
  "telefono",
  "contacto",
  "direccion",
  "ciudad",
  "estado",
  "cp",
  "dias_credito",
] as const;

const clienteRowSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre: requerido.").max(200),
  rfc: z.string().trim().max(20).optional(),
  email: z
    .string()
    .trim()
    .max(254)
    .email("Correo: formato inválido.")
    .optional()
    .or(z.literal("")),
  telefono: z.string().trim().max(40).optional(),
  contacto: z.string().trim().max(150).optional(),
  direccion: z.string().trim().max(300).optional(),
  ciudad: z.string().trim().max(120).optional(),
  estado: z.string().trim().max(120).optional(),
  cp: z.string().trim().max(10).optional(),
  dias_credito: z
    .string()
    .optional()
    .refine(
      (v) => v === undefined || v === "" || /^\d+$/.test(v),
      "Días de crédito: debe ser entero.",
    ),
});

export interface ImportRowResult<T> {
  rowNumber: number; // 1-indexado considerando que la fila 1 es encabezado
  payload: T;
}

export interface ImportRowError {
  rowNumber: number;
  message: string;
  raw: Row;
}

export interface ImportPreview<T> {
  valid: ImportRowResult<T>[];
  invalid: ImportRowError[];
}

function firstZodMessage(err: z.ZodError): string {
  const i = err.issues[0];
  if (!i) return "Inválido.";
  const path = i.path?.join(".");
  return path ? `${path}: ${i.message}` : i.message;
}

export function mapClienteRows(
  rows: Row[],
  organizationId: string | null,
): ImportPreview<TablesInsert<"clientes">> {
  const valid: ImportRowResult<TablesInsert<"clientes">>[] = [];
  const invalid: ImportRowError[] = [];

  rows.forEach((raw, idx) => {
    const rowNumber = idx + 2; // +1 por header, +1 para 1-indexar
    const parsed = clienteRowSchema.safeParse(raw);
    if (!parsed.success) {
      invalid.push({ rowNumber, message: firstZodMessage(parsed.error), raw });
      return;
    }
    const v = parsed.data;
    const payload: TablesInsert<"clientes"> = {
      nombre: v.nombre,
      rfc: optional(v.rfc) ?? "",
      email: optional(v.email ?? undefined) ?? "",
      telefono: optional(v.telefono) ?? "",
      contacto: optional(v.contacto) ?? "",
      direccion: optional(v.direccion) ?? "",
      ciudad: optional(v.ciudad) ?? "",
      estado: optional(v.estado) ?? "",
      cp: optional(v.cp) ?? "",
      dias_credito: v.dias_credito ? Number(v.dias_credito) : null,
      ...(organizationId ? { organization_id: organizationId } : {}),
    };
    valid.push({ rowNumber, payload });
  });

  return { valid, invalid };
}

// ── Proveedor ─────────────────────────────────────────────────────────

const TIPOS_PROVEEDOR = [
  "Naviera",
  "Aerolínea",
  "Transportista",
  "Agente Aduanal",
  "Agente de Carga",
  "Aseguradora",
  "Custodia",
  "Almacenes",
  "Acondicionamiento de Carga",
  "Materiales Peligrosos",
] as const;

const MONEDAS = ["MXN", "USD", "EUR"] as const;

export const PROVEEDOR_TEMPLATE_HEADERS = [
  "nombre",
  "tipo",
  "rfc",
  "contacto",
  "telefono",
  "email",
  "moneda_preferida",
  "pais",
] as const;

const proveedorRowSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre: requerido.").max(200),
  tipo: z.enum(TIPOS_PROVEEDOR, {
    errorMap: () => ({ message: `Tipo: debe ser uno de ${TIPOS_PROVEEDOR.join(", ")}.` }),
  }),
  rfc: z.string().trim().max(20).optional(),
  contacto: z.string().trim().max(150).optional(),
  telefono: z.string().trim().max(40).optional(),
  email: z
    .string()
    .trim()
    .max(254)
    .email("Correo: formato inválido.")
    .optional()
    .or(z.literal("")),
  moneda_preferida: z
    .enum(MONEDAS, { errorMap: () => ({ message: "Moneda: MXN, USD o EUR." }) })
    .optional(),
  pais: z.string().trim().max(120).optional(),
});

export function mapProveedorRows(
  rows: Row[],
  organizationId: string | null,
  defaultTipo?: (typeof TIPOS_PROVEEDOR)[number],
): ImportPreview<TablesInsert<"proveedores">> {
  const valid: ImportRowResult<TablesInsert<"proveedores">>[] = [];
  const invalid: ImportRowError[] = [];

  rows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    // Si el CSV no trae tipo y la página fija uno (tab activa), inyectarlo.
    const effective: Row = { ...raw };
    if (!effective.tipo && defaultTipo) effective.tipo = defaultTipo;
    const parsed = proveedorRowSchema.safeParse(effective);
    if (!parsed.success) {
      invalid.push({ rowNumber, message: firstZodMessage(parsed.error), raw });
      return;
    }
    const v = parsed.data;
    const payload: TablesInsert<"proveedores"> = {
      nombre: v.nombre,
      tipo: v.tipo,
      rfc: optional(v.rfc) ?? "",
      contacto: optional(v.contacto) ?? "",
      telefono: optional(v.telefono) ?? "",
      email: optional(v.email ?? undefined) ?? "",
      moneda_preferida: v.moneda_preferida ?? "MXN",
      pais: optional(v.pais),
      ...(organizationId ? { organization_id: organizationId } : {}),
    };
    valid.push({ rowNumber, payload });
  });

  return { valid, invalid };
}

export { TIPOS_PROVEEDOR };
