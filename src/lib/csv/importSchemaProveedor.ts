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
