/**
 * Tipos para la entidad embarque_contenedores (Fase A del refactor 1 embarque ↔ N).
 */
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type EmbarqueContenedor =
  Database["public"]["Tables"]["embarque_contenedores"]["Row"];

export type EmbarqueContenedorInsert =
  Database["public"]["Tables"]["embarque_contenedores"]["Insert"];


/**
 * Borrador editable en formularios (sin id/organization_id; antes de persistir).
 */
export interface ContenedorBorrador {
  id?: string;
  numero_contenedor: string;
  tipo_contenedor: string;
  bl_house: string;
  peso_kg: number;
  volumen_m3: number;
  piezas: number;
  orden: number;
}

const contenedorBorradorSchema = z.object({
  id: z.string().uuid().optional(),
  numero_contenedor: z
    .string()
    .trim()
    .min(1, "Número de contenedor requerido")
    .max(20, "Máximo 20 caracteres"),
  tipo_contenedor: z.string().trim().min(1, "Tipo requerido"),
  bl_house: z.string().trim().max(50, "Máximo 50 caracteres").default(""),
  peso_kg: z.number().min(0, "Peso debe ser ≥ 0"),
  volumen_m3: z.number().min(0, "Volumen debe ser ≥ 0"),
  piezas: z.number().int().min(0, "Piezas debe ser ≥ 0"),
  orden: z.number().int().min(1),
});


export function crearContenedorVacio(orden: number = 1): ContenedorBorrador {
  return {
    numero_contenedor: "",
    tipo_contenedor: "",
    bl_house: "",
    peso_kg: 0,
    volumen_m3: 0,
    piezas: 0,
    orden,
  };
}

export function rowAContenedorBorrador(row: EmbarqueContenedor): ContenedorBorrador {
  return {
    id: row.id,
    numero_contenedor: row.numero_contenedor,
    tipo_contenedor: row.tipo_contenedor,
    bl_house: row.bl_house,
    peso_kg: Number(row.peso_kg),
    volumen_m3: Number(row.volumen_m3),
    piezas: row.piezas,
    orden: row.orden,
  };
}
