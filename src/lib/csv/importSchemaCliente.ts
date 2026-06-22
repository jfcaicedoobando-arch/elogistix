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
  "regimen_fiscal",
  "uso_cfdi_default",
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

export function mapClienteRows(
  rows: Row[],
  organizationId: string | null,
): ImportPreview<TablesInsert<"clientes">> {
  const valid: ImportRowResult<TablesInsert<"clientes">>[] = [];
  const invalid: ImportRowError[] = [];

  rows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
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
