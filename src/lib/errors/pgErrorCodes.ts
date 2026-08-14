/**
 * Traduce errores crudos de Postgres/PostgREST (RLS, llaves foráneas,
 * unicidad, check constraints, campos obligatorios, timeouts) a mensajes de
 * negocio en es-MX. El texto técnico original (código, tabla, detalle) NUNCA
 * debe mostrarse como título del toast: sólo se usa en consola/"Ver detalles".
 * Ver Q-15.3.
 *
 * v13.615.0 (Ola 17) — se amplió el catálogo de SQLSTATE y los mensajes por
 * constraint viven en `pgConstraintMessages.ts`.
 */
import {
  extraerColumna, humanizarColumna, mensajeConstraintUnico,
} from "./pgConstraintMessages";

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

/** Errores de permisos/RLS (42501 y variantes de texto). */
function traducirPermisos(raw: string, code: string | null | undefined, tableLabel: string): string | null {
  // "permission denied for function X": la petición llegó sin sesión válida
  // (JWT expirado → rol `anon`), no por falta de rol de negocio.
  if (/permission denied for function/i.test(raw)) {
    return "Tu sesión expiró o no está activa. Vuelve a iniciar sesión e intenta de nuevo.";
  }
  if (code === "42501" || /permission denied for table/i.test(raw)) {
    return `No tienes permisos para realizar esta acción sobre ${tableLabel}. Contacta a un administrador si crees que deberías tener acceso.`;
  }
  if (/row-level security policy/i.test(raw)) {
    return `No tienes permisos para guardar cambios en ${tableLabel}. Verifica que el registro pertenezca a tu organización o contacta a un administrador.`;
  }
  return null;
}

/** Violaciones de integridad (clase 23). */
function traducirIntegridad(raw: string, code: string | null | undefined): string | null {
  if (code === "23503" || /violates foreign key constraint/i.test(raw)) {
    return "No se puede completar la operación porque este registro está relacionado con otros datos existentes (por ejemplo, movimientos o documentos asociados). Elimínalos o desvincúlalos primero.";
  }

  if (code === "23505" || /duplicate key value violates unique constraint/i.test(raw)) {
    return mensajeConstraintUnico(raw)
      ?? "Ya existe un registro con esos mismos datos. Verifica los campos que deben ser únicos (por ejemplo folio, RFC o correo) e intenta de nuevo.";
  }

  if (code === "23502" || /null value in column/i.test(raw)) {
    return `Falta capturar ${humanizarColumna(extraerColumna(raw))}. Complétalo e intenta de nuevo.`;
  }

  if (code === "23514" || /violates check constraint/i.test(raw)) {
    return "Los datos capturados no cumplen una regla de validación del sistema. Revisa los campos e intenta de nuevo.";
  }

  if (code === "23P01" || /conflicting key value violates exclusion constraint/i.test(raw)) {
    return "El periodo o rango capturado se traslapa con otro registro existente. Ajusta las fechas e intenta de nuevo.";
  }

  return null;
}

/** Errores de formato/longitud de datos (clase 22). */
function traducirDatos(raw: string, code: string | null | undefined): string | null {
  if (code === "22001" || /value too long for type/i.test(raw)) {
    return `El texto capturado en ${humanizarColumna(extraerColumna(raw))} es demasiado largo. Acórtalo e intenta de nuevo.`;
  }
  if (code === "22P02" || /invalid input syntax/i.test(raw)) {
    return "Alguno de los datos capturados tiene un formato inválido (número, fecha o identificador). Revisa los campos resaltados e intenta de nuevo.";
  }
  if (code === "22003" || /numeric field overflow|out of range/i.test(raw)) {
    return "El monto o la cantidad capturada excede el límite permitido. Verifica que no sobren dígitos.";
  }
  if (code === "22007" || code === "22008" || /invalid.*date|date\/time field/i.test(raw)) {
    return "La fecha capturada no es válida. Usa el formato DD/MM/AAAA.";
  }
  return null;
}

/** Concurrencia y tiempos de espera (clases 40 y 57). */
function traducirConcurrencia(raw: string, code: string | null | undefined): string | null {
  if (code === "40001" || /could not serialize access/i.test(raw)) {
    return "Otro usuario guardó cambios sobre este registro al mismo tiempo. Refresca la pantalla e intenta de nuevo.";
  }
  if (code === "40P01" || /deadlock detected/i.test(raw)) {
    return "Dos operaciones se bloquearon entre sí. Espera unos segundos e intenta de nuevo.";
  }
  if (code === "55P03" || /lock.*not available/i.test(raw)) {
    return "El registro está siendo editado por otra operación en este momento. Intenta de nuevo en unos segundos.";
  }
  if (code === "57014" || /canceling statement due to statement timeout/i.test(raw)) {
    return "La consulta tardó demasiado y se canceló. Acota el rango de fechas o los filtros e intenta de nuevo.";
  }
  return null;
}

/**
 * Mensajes lanzados con `RAISE EXCEPTION` desde la base de datos (P0001).
 * Se conserva el texto del `RAISE` porque ya está redactado para el usuario;
 * sólo se limpian los prefijos técnicos que agrega PostgREST.
 */
function traducirRaise(raw: string, code: string | null | undefined): string | null {
  if (code !== "P0001" && code !== "P0002") return null;
  const limpio = raw
    .replace(/^ERROR:\s*/i, "")
    .replace(/\s*—\s*(null|undefined)/gi, "")
    .trim();
  if (!limpio) return null;
  // Si el mensaje trae un código LC_*, lo resuelve el catálogo LC (paso 3 del
  // pipeline en `index.ts`), no aquí.
  if (/LC_[A-Z0-9_]+/.test(limpio)) return null;
  if (code === "P0002") {
    return "El registro que intentas usar ya no existe o fue eliminado. Refresca la pantalla.";
  }
  return limpio;
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
  const tableLabel = humanizeTable(extractTable(raw));
  return traducirPermisos(raw, code, tableLabel)
    ?? traducirIntegridad(raw, code)
    ?? traducirDatos(raw, code)
    ?? traducirConcurrencia(raw, code)
    ?? traducirRaise(raw, code);
}
