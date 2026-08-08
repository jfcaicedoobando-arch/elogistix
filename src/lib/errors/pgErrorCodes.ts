/**
 * Traduce errores crudos de Postgres/PostgREST (RLS, llaves foráneas,
 * unicidad, check constraints) a mensajes de negocio en es-MX. El texto
 * técnico original (código, tabla, detalle) NUNCA debe mostrarse como
 * título del toast: sólo se usa en consola/"Ver detalles". Ver Q-15.3.
 */

const TABLE_LABELS: Record<string, string> = {
  facturas: "facturas",
  cotizaciones: "cotizaciones",
  embarques: "embarques",
  clientes: "clientes",
  proveedores: "proveedores",
  pagos: "pagos",
  cuentas_por_cobrar: "cuentas por cobrar",
  cuentas_por_pagar: "cuentas por pagar",
};

function humanizeTable(table: string | null): string {
  if (!table) return "este registro";
  return TABLE_LABELS[table] ?? table.replace(/_/g, " ");
}

function extractTable(raw: string): string | null {
  const m = raw.match(/for table "?([a-zA-Z0-9_.]+)"?/i);
  return m ? m[1] : null;
}

/**
 * Intenta traducir un error de Postgres a un mensaje de negocio, usando el
 * `code` (SQLSTATE) cuando está disponible y, si no, patrones de texto
 * conocidos (RLS). Devuelve `null` si no reconoce el error.
 */
export function translatePostgresError(
  raw: string,
  code?: string | null,
): string | null {
  const table = extractTable(raw);
  const tableLabel = humanizeTable(table);

  // "permission denied for function X": ocurre cuando la petición llega sin
  // sesión válida (JWT expirado → rol `anon`), no por falta de rol de negocio.
  // El GRANT correcto (authenticated + service_role) ya existe en la BD.
  if (/permission denied for function/i.test(raw)) {
    return "Tu sesión expiró o no está activa. Vuelve a iniciar sesión e intenta de nuevo.";
  }

  // 42501: permission denied (incluye RLS con USING que falla silenciosamente)
  if (code === "42501" || /permission denied for table/i.test(raw)) {
    return `No tienes permisos para realizar esta acción sobre ${tableLabel}. Contacta a un administrador si crees que deberías tener acceso.`;
  }

  // RLS: "new row violates row-level security policy for table "X""
  if (/row-level security policy/i.test(raw)) {
    return `No tienes permisos para guardar cambios en ${tableLabel}. Verifica que el registro pertenezca a tu organización o contacta a un administrador.`;
  }

  if (code === "23503" || /violates foreign key constraint/i.test(raw)) {
    return "No se puede completar la operación porque este registro está relacionado con otros datos existentes (por ejemplo, movimientos o documentos asociados). Elimínalos o desvincúlalos primero.";
  }

  if (code === "23505" || /duplicate key value violates unique constraint/i.test(raw)) {
    // FIX 6 (P3): constraints con mensaje de negocio propio. El nombre técnico
    // del índice nunca se muestra al usuario.
    if (/proveedor_facturas_org_prov_folio/i.test(raw)) {
      return "Ya registraste una factura de este proveedor con ese folio. Verifica el folio o busca la factura existente.";
    }
    if (/facturas?_.*folio/i.test(raw)) {
      return "Ya existe una factura con ese folio en tu organización. Usa un folio distinto.";
    }
    if (/clientes_rfc/i.test(raw)) {
      return "Ya existe un cliente con ese RFC. Búscalo en el listado en lugar de crearlo de nuevo.";
    }
    return "Ya existe un registro con esos mismos datos. Verifica los campos que deben ser únicos (por ejemplo folio, RFC o correo) e intenta de nuevo.";
  }

  if (code === "23514" || /violates check constraint/i.test(raw)) {
    return "Los datos capturados no cumplen una regla de validación del sistema. Revisa los campos e intenta de nuevo.";
  }

  return null;
}
