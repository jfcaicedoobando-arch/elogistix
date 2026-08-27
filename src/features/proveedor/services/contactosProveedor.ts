/**
 * Ola 4 — Acceso a datos de los contactos del proveedor.
 * La tabla `proveedor_contactos` tiene RLS por organización y un trigger que
 * garantiza un solo contacto principal por proveedor.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";
import { primeraFila } from "@/lib/supabase/primeraFila";
import { conflictoConcurrenciaError } from "@/lib/errors/concurrencia";
import type {
  ContactoProveedor,
  ContactoProveedorForm,
} from "@/features/proveedor/domain/contactosProveedor";

const SELECT =
  "id, proveedor_id, nombre, puesto, area, email, telefono, extension, es_principal, notas, created_at, updated_at" as const;

export async function fetchProveedorContactos(
  proveedorId: string,
): Promise<ContactoProveedor[]> {
  const filas = await unwrapOr(
    supabase
      .from("proveedor_contactos")
      .select(SELECT)
      .eq("proveedor_id", proveedorId)
      .is("deleted_at", null)
      .order("es_principal", { ascending: false })
      .order("nombre", { ascending: true }),
    [],
  );
  return (filas ?? []) as ContactoProveedor[];
}

function aFila(form: ContactoProveedorForm) {
  return {
    nombre: form.nombre.trim(),
    puesto: form.puesto.trim(),
    area: form.area.trim(),
    email: form.email.trim().toLowerCase(),
    telefono: form.telefono.trim(),
    extension: form.extension.trim(),
    es_principal: form.es_principal,
    notas: form.notas.trim() || null,
  };
}

export async function crearContactoProveedor(input: {
  proveedorId: string;
  organizationId: string;
  form: ContactoProveedorForm;
}): Promise<ContactoProveedor> {
  const { data: sesion } = await supabase.auth.getUser();
  const fila = await unwrap(
    supabase
      .from("proveedor_contactos")
      .insert({
        proveedor_id: input.proveedorId,
        organization_id: input.organizationId,
        created_by: sesion.user?.id ?? null,
        ...aFila(input.form),
      })
      .select(SELECT)
      .single(),
  );
  return fila as ContactoProveedor;
}

export async function actualizarContactoProveedor(input: {
  id: string;
  form: ContactoProveedorForm;
  /** H5 (Ola 4): `updated_at` leído al abrir el formulario. */
  expectedUpdatedAt?: string | null;
}): Promise<void> {
  let query = supabase
    .from("proveedor_contactos")
    .update(aFila(input.form))
    .eq("id", input.id);
  if (input.expectedUpdatedAt) query = query.eq("updated_at", input.expectedUpdatedAt);
  const filas = primeraFila((await unwrap(query.select("id"))) as Array<{ id: string }> | null);
  if (!filas) {
    if (input.expectedUpdatedAt) throw conflictoConcurrenciaError();
    throw new Error("No se guardaron los cambios: el contacto ya no existe o no tienes permiso.");
  }
}

/** Borrado lógico: conservamos el histórico de con quién tratábamos. */
export async function eliminarContactoProveedor(id: string): Promise<void> {
  const { data: sesion } = await supabase.auth.getUser();
  await run(
    supabase
      .from("proveedor_contactos")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: sesion.user?.id ?? null,
        es_principal: false,
      })
      .eq("id", id),
  );
}
