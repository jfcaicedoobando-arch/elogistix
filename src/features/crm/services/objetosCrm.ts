/**
 * Servicio CRM por objetos (Fase 2): Empresas y Contactos + sus vínculos.
 * Lecturas paginadas en servidor; el aislamiento por organización lo hace RLS.
 */
import { supabase } from "@/integrations/supabase/client";

export const OBJETOS_PAGE_SIZE = 25;

export interface EmpresaRow { id: string; nombre: string; cliente_id: string | null; created_at: string }
export interface ContactoRow { id: string; nombre: string; email: string | null; telefono: string | null; created_at: string }
export interface Pagina<T> { filas: T[]; total: number }
export interface RefRow { id: string; nombre: string }

function rango(pagina: number) {
  const desde = pagina * OBJETOS_PAGE_SIZE;
  return [desde, desde + OBJETOS_PAGE_SIZE - 1] as const;
}

function limpiarBusqueda(texto: string): string {
  // Evita que comas/paréntesis rompan el filtro de PostgREST.
  return texto.trim().replace(/[%,()]/g, " ");
}

/** `letra` filtra por la columna calculada `letra_crm` (puntaje A/B/C en servidor). */
export async function fetchEmpresas(busqueda: string, pagina: number, letra = "todas"): Promise<Pagina<EmpresaRow>> {
  const [desde, hasta] = rango(pagina);
  let q = supabase.from("crm_empresas")
    .select("id, nombre, cliente_id, created_at", { count: "exact" })
    .is("deleted_at", null).order("nombre").range(desde, hasta);
  const term = limpiarBusqueda(busqueda);
  if (term) q = q.ilike("nombre", `%${term}%`);
  if (letra !== "todas") q = q.eq("letra_crm", letra);
  const { data, error, count } = await q;
  if (error) throw error;
  return { filas: data ?? [], total: count ?? 0 };
}

export async function fetchContactos(busqueda: string, pagina: number): Promise<Pagina<ContactoRow>> {
  const [desde, hasta] = rango(pagina);
  let q = supabase.from("crm_contactos")
    .select("id, nombre, email, telefono, created_at", { count: "exact" })
    .is("deleted_at", null).order("nombre").range(desde, hasta);
  const term = limpiarBusqueda(busqueda);
  if (term) q = q.or(`nombre.ilike.%${term}%,email.ilike.%${term}%`);
  const { data, error, count } = await q;
  if (error) throw error;
  return { filas: data ?? [], total: count ?? 0 };
}

export async function fetchEmpresa(id: string): Promise<EmpresaRow | null> {
  const { data, error } = await supabase.from("crm_empresas")
    .select("id, nombre, cliente_id, created_at").eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchContacto(id: string): Promise<ContactoRow | null> {
  const { data, error } = await supabase.from("crm_contactos")
    .select("id, nombre, email, telefono, created_at").eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  return data;
}

export async function crearEmpresa(nombre: string): Promise<RefRow> {
  const limpio = nombre.trim();
  if (!limpio) throw new Error("El nombre de la empresa es obligatorio");
  const { data, error } = await supabase.from("crm_empresas").insert({ nombre: limpio })
    .select("id, nombre").single();
  if (error) throw error;
  return data;
}

export interface NuevoContactoInput { nombre: string; email?: string; telefono?: string }

export async function crearContacto(input: NuevoContactoInput): Promise<RefRow> {
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("El nombre del contacto es obligatorio");
  const email = input.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("El correo no es válido");
  const { data, error } = await supabase.from("crm_contactos")
    .insert({ nombre, email, telefono: input.telefono?.trim() || null })
    .select("id, nombre").single();
  if (error) throw error;
  return data;
}
