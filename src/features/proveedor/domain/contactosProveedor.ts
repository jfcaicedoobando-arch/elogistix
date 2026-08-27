/**
 * Ola 4 — Contactos múltiples del proveedor (lógica pura, sin red ni UI).
 * Espejo de los contactos del cliente: varias personas por proveedor, con un
 * único contacto principal (el que usamos por defecto para avisos y pagos).
 */
export interface ContactoProveedor {
  id: string;
  proveedor_id: string;
  nombre: string;
  puesto: string;
  area: string;
  email: string;
  telefono: string;
  extension: string;
  es_principal: boolean;
  notas: string | null;
  created_at: string;
  /** Sello de versión para el bloqueo optimista al editar (H5). */
  updated_at?: string | null;
}

export interface ContactoProveedorForm {
  nombre: string;
  puesto: string;
  area: string;
  email: string;
  telefono: string;
  extension: string;
  es_principal: boolean;
  notas: string;
}

export const CONTACTO_PROVEEDOR_VACIO: ContactoProveedorForm = {
  nombre: "",
  puesto: "",
  area: "",
  email: "",
  telefono: "",
  extension: "",
  es_principal: false,
  notas: "",
};

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Devuelve el mensaje de error bloqueante o `null` si el contacto es válido. */
export function validarContactoProveedor(form: ContactoProveedorForm): string | null {
  if (form.nombre.trim().length < 3) {
    return "Captura el nombre completo del contacto (mínimo 3 caracteres).";
  }
  if (form.email.trim() && !RE_EMAIL.test(form.email.trim())) {
    return "El correo del contacto no tiene un formato válido.";
  }
  if (!form.email.trim() && !form.telefono.trim()) {
    return "Captura al menos un medio de contacto: correo o teléfono.";
  }
  return null;
}

/** Principal primero, luego alfabético: el orden que espera el usuario. */
export function ordenarContactos(contactos: ContactoProveedor[]): ContactoProveedor[] {
  return [...contactos].sort((a, b) => {
    if (a.es_principal !== b.es_principal) return a.es_principal ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, "es-MX");
  });
}

export function contactoPrincipal(
  contactos: ContactoProveedor[],
): ContactoProveedor | null {
  return contactos.find((c) => c.es_principal) ?? null;
}

export function contactoAForm(c: ContactoProveedor): ContactoProveedorForm {
  return {
    nombre: c.nombre,
    puesto: c.puesto ?? "",
    area: c.area ?? "",
    email: c.email ?? "",
    telefono: c.telefono ?? "",
    extension: c.extension ?? "",
    es_principal: c.es_principal,
    notas: c.notas ?? "",
  };
}
