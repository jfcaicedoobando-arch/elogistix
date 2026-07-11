import { z } from "zod";
import type { TablesInsert } from "@/integrations/supabase/types";
import {
  firstZodMessage,
  optional,
  type ImportPreview,
  type ImportRowError,
  type ImportRowResult,
  type Row,
} from "./importSchemasShared";

export const TIPOS_PROVEEDOR = [
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

const CATEGORIAS = ["Logistico", "GastoOperativo"] as const;
const SUBTIPOS_GASTO = [
  "Renta",
  "Servicios",
  "Papeleria",
  "Software",
  "Honorarios",
  "Mantenimiento",
  "Marketing",
  "Viaticos",
  "Otros",
] as const;
const MONEDAS = ["MXN", "USD", "EUR"] as const;

export const PROVEEDOR_TEMPLATE_HEADERS = [
  "nombre",
  "categoria",
  "tipo",
  "subtipo_gasto",
  "rfc",
  "contacto",
  "telefono",
  "email",
  "moneda_preferida",
  "pais",
] as const;

const proveedorRowSchema = z
  .object({
    nombre: z.string().trim().min(1, "Nombre: requerido.").max(200),
    categoria: z
      .enum([...CATEGORIAS], { error: () => ({ message: "Categoría: Logistico o GastoOperativo." }) })
      .optional(),
    tipo: z
      .enum([...TIPOS_PROVEEDOR], {
        error: () => ({ message: `Tipo: debe ser uno de ${TIPOS_PROVEEDOR.join(", ")}.` }),
      })
      .optional(),
    subtipo_gasto: z
      .enum([...SUBTIPOS_GASTO], {
        error: () => ({ message: `Subtipo de gasto: ${SUBTIPOS_GASTO.join(", ")}.` }),
      })
      .optional(),
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
      .enum([...MONEDAS], { error: () => ({ message: "Moneda: MXN, USD o EUR." }) })
      .optional(),
    pais: z.string().trim().max(120).optional(),
  })
  .superRefine((data, ctx) => {
    const cat = data.categoria ?? "Logistico";
    if (cat === "Logistico" && !data.tipo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Tipo: requerido para proveedores logísticos." });
    }
    if (cat === "GastoOperativo" && !data.subtipo_gasto) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Subtipo de gasto: requerido para gastos operativos." });
    }
  });

function buildProveedorPayload(
  v: z.infer<typeof proveedorRowSchema>,
  organizationId: string | null,
): TablesInsert<"proveedores"> {
  const categoria = v.categoria ?? "Logistico";
  return {
    nombre: v.nombre,
    categoria,
    tipo: categoria === "Logistico" ? (v.tipo ?? null) : null,
    subtipo_gasto: categoria === "GastoOperativo" ? (v.subtipo_gasto ?? null) : null,
    rfc: optional(v.rfc) ?? "",
    contacto: optional(v.contacto) ?? "",
    telefono: optional(v.telefono) ?? "",
    email: optional(v.email ?? undefined) ?? "",
    moneda_preferida: v.moneda_preferida ?? "MXN",
    pais: optional(v.pais),
    ...(organizationId ? { organization_id: organizationId } : {}),
  };
}

export function mapProveedorRows(
  rows: Row[],
  organizationId: string | null,
  defaultTipo?: (typeof TIPOS_PROVEEDOR)[number],
): ImportPreview<TablesInsert<"proveedores">> {
  const valid: ImportRowResult<TablesInsert<"proveedores">>[] = [];
  const invalid: ImportRowError[] = [];

  rows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const effective: Row = { ...raw };
    if (!effective.categoria) effective.categoria = "Logistico";
    if (!effective.tipo && defaultTipo && effective.categoria === "Logistico") {
      effective.tipo = defaultTipo;
    }
    const parsed = proveedorRowSchema.safeParse(effective);
    if (!parsed.success) {
      invalid.push({ rowNumber, message: firstZodMessage(parsed.error), raw });
      return;
    }
    valid.push({ rowNumber, payload: buildProveedorPayload(parsed.data, organizationId) });
  });

  return { valid, invalid };
}
