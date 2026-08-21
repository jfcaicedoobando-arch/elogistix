/**
 * Mensajes de negocio por constraint/índice de Postgres.
 *
 * v13.615.0 (Ola 17) — antes vivían como `if` anidados dentro de
 * `translatePostgresError`. El nombre técnico del índice NUNCA se muestra al
 * usuario: sólo se usa para elegir el texto en es-MX.
 *
 * Para agregar un constraint nuevo basta con sumar una entrada aquí.
 */

interface ConstraintMessage {
  /** Patrón que identifica el constraint dentro del texto crudo del error. */
  match: RegExp;
  /** Mensaje de negocio en es-MX (qué pasó + qué hacer). */
  message: string;
}

/** Constraints de unicidad (SQLSTATE 23505). */
export const UNIQUE_CONSTRAINT_MESSAGES: readonly ConstraintMessage[] = [
  {
    match: /proveedor_facturas_org_prov_folio/i,
    message:
      "Ya registraste una factura de este proveedor con ese folio. Verifica el folio o busca la factura existente.",
  },
  {
    match: /proveedor_facturas.*uuid|uuid.*proveedor_facturas/i,
    message:
      "Ya existe una factura de proveedor con ese UUID fiscal. Búscala en el listado en lugar de capturarla de nuevo.",
  },
  {
    match: /facturas?_.*folio|folio_secuencias/i,
    message:
      "Ya existe una factura con ese folio en tu organización. Usa un folio distinto.",
  },
  {
    match: /facturas?_.*uuid_fiscal/i,
    message:
      "Ya existe una factura con ese UUID fiscal (folio fiscal del SAT). Revisa si el CFDI ya fue registrado.",
  },
  {
    match: /clientes_rfc/i,
    message:
      "Ya existe un cliente con ese RFC. Búscalo en el listado en lugar de crearlo de nuevo.",
  },
  {
    match: /proveedores_rfc/i,
    message:
      "Ya existe un proveedor con ese RFC. Búscalo en el listado en lugar de crearlo de nuevo.",
  },
  {
    match: /refacturaciones?_.*abierta|refacturaciones_una_abierta/i,
    message:
      "Esta factura ya tiene un caso de refacturación abierto. Ciérralo o cancélalo antes de abrir otro.",
  },
  {
    match: /contacto_principal|contactos?_.*principal/i,
    message:
      "Sólo puede haber un contacto principal. Quita la marca al contacto principal actual antes de asignarla a otro.",
  },
  {
    match: /idempotency_keys?_/i,
    message:
      "Esta operación ya se registró (posible doble clic). Refresca la pantalla para ver el resultado.",
  },
  {
    // Ola 1 (major release): llaves de idempotencia por submit en pagos y
    // traspasos. El usuario no debe ver el nombre del índice, sólo que su
    // movimiento ya quedó registrado una sola vez.
    match: /client_request_id/i,
    message:
      "Este movimiento ya se registró con esta misma solicitud (posible doble clic). Refresca la pantalla: el pago quedó guardado una sola vez.",
  },

  {
    match: /embarques?_.*expediente|expediente_unico/i,
    message:
      "Ya existe un embarque con ese número de expediente. Verifica el consecutivo.",
  },
  {
    match: /user_roles?_user_id_role/i,
    message: "Este usuario ya tiene asignado ese rol.",
  },
];

/**
 * Devuelve el mensaje de negocio del constraint de unicidad violado, o `null`
 * si no hay uno específico (el llamador usa el mensaje genérico).
 */
export function mensajeConstraintUnico(raw: string): string | null {
  for (const { match, message } of UNIQUE_CONSTRAINT_MESSAGES) {
    if (match.test(raw)) return message;
  }
  return null;
}

const COLUMN_LABELS: Record<string, string> = {
  rfc: "el RFC",
  folio: "el folio",
  uuid_fiscal: "el UUID fiscal",
  organization_id: "la organización",
  cliente_id: "el cliente",
  proveedor_id: "el proveedor",
  embarque_id: "el embarque",
  moneda: "la moneda",
  monto: "el monto",
  total: "el total",
  fecha: "la fecha",
  fecha_pago: "la fecha de pago",
  tipo_cambio: "el tipo de cambio",
  razon_social: "la razón social",
  correo: "el correo",
  email: "el correo",
};

/** Etiqueta legible de una columna (`fecha_pago` → "la fecha de pago"). */
export function humanizarColumna(col: string | null): string {
  if (!col) return "un campo obligatorio";
  return COLUMN_LABELS[col] ?? `el campo "${col.replace(/_/g, " ")}"`;
}

/** Extrae el nombre de columna que reporta Postgres (23502, 22001, 22P02). */
export function extraerColumna(raw: string): string | null {
  const m = raw.match(/column "?([a-zA-Z0-9_]+)"?/i);
  return m ? m[1] : null;
}
