/**
 * Generación de descripciones legibles para entradas de bitácora.
 * Función pura: a partir de `accion + modulo + detalles` devuelve un título
 * descriptivo y un contexto secundario opcional.
 */
import type { EntradaBitacora } from "@/hooks/shared/useBitacora";
import { formatCurrency } from "@/lib/formatters";

export interface DescripcionBitacora {
  titulo: string;
  contexto?: string;
  /** Si es cambio de estado, exponemos los dos estados para render con badges. */
  estadoAnterior?: string;
  estadoNuevo?: string;
}

const MODULO_SINGULAR: Record<string, string> = {
  embarques: "embarque",
  clientes: "cliente",
  proveedores: "proveedor",
  cotizaciones: "cotización",
  facturas: "factura",
  usuarios: "usuario",
};

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function describirEmbarqueCreado(detalles: Record<string, unknown>): DescripcionBitacora {
  const modo = asString(detalles.modo);
  const tipo = asString(detalles.tipo);
  const cliente = asString(detalles.cliente);
  const cotizacionFolio = asString(detalles.cotizacion_folio);
  const partes: string[] = ["Creó embarque"];
  if (modo) partes.push(modo.toLowerCase());
  if (tipo) partes.push(`de ${tipo.toLowerCase()}`);
  const titulo = partes.join(" ");
  const ctx: string[] = [];
  if (cliente) ctx.push(cliente);
  if (cotizacionFolio) ctx.push(`desde cotización ${cotizacionFolio}`);
  return { titulo, contexto: ctx.join(" · ") || undefined };
}

function describirEmbarqueEditado(detalles: Record<string, unknown>): DescripcionBitacora {
  const cliente = asString(detalles.cliente);
  const modo = asString(detalles.modo);
  const ctx = [cliente, modo].filter(Boolean).join(" · ");
  return { titulo: "Editó embarque", contexto: ctx || undefined };
}

function describirCambioEstado(detalles: Record<string, unknown>): DescripcionBitacora {
  const anterior = asString(detalles.estado_anterior);
  const nuevo = asString(detalles.estado_nuevo);
  if (anterior && nuevo) {
    return {
      titulo: `Cambió estado de ${anterior} a ${nuevo}`,
      estadoAnterior: anterior,
      estadoNuevo: nuevo,
    };
  }
  if (nuevo) return { titulo: `Cambió estado a ${nuevo}`, estadoNuevo: nuevo };
  return { titulo: "Cambió estado" };
}

function describirDocumento(accion: string, detalles: Record<string, unknown>): DescripcionBitacora {
  const tipoDoc = asString(detalles.tipo_documento) ?? asString(detalles.nombre) ?? "documento";
  const verbo = accion === "subir_documento" ? "Subió" : "Eliminó";
  return { titulo: `${verbo} ${tipoDoc}` };
}

function describirNota(detalles: Record<string, unknown>): DescripcionBitacora {
  const contenido = asString(detalles.contenido) ?? asString(detalles.nota);
  if (!contenido) return { titulo: "Agregó una nota" };
  const preview = contenido.length > 80 ? `${contenido.slice(0, 80)}…` : contenido;
  return { titulo: "Agregó nota", contexto: preview };
}

function describirFactura(detalles: Record<string, unknown>): DescripcionBitacora {
  const folio = asString(detalles.folio);
  const monto = asNumber(detalles.monto) ?? asNumber(detalles.total);
  const moneda = asString(detalles.moneda) ?? "MXN";
  const titulo = folio ? `Generó factura ${folio}` : "Generó factura";
  const contexto = monto !== undefined ? formatCurrency(monto, moneda) : undefined;
  return { titulo, contexto };
}

function describirCreacionGenerica(modulo: string): DescripcionBitacora {
  const singular = MODULO_SINGULAR[modulo] ?? "registro";
  const articulo = singular === "cotización" || singular === "factura" ? "una" : "un";
  return { titulo: `Creó ${articulo} ${singular}` };
}

function describirEdicionGenerica(modulo: string): DescripcionBitacora {
  const singular = MODULO_SINGULAR[modulo] ?? "registro";
  return { titulo: `Editó ${singular}` };
}

function describirEliminacionGenerica(modulo: string): DescripcionBitacora {
  const singular = MODULO_SINGULAR[modulo] ?? "registro";
  return { titulo: `Eliminó ${singular}` };
}

export function describirEntrada(entrada: EntradaBitacora): DescripcionBitacora {
  const detalles = (entrada.detalles ?? {}) as Record<string, unknown>;
  const { accion, modulo } = entrada;

  if (accion === "login") return { titulo: "Inició sesión" };

  if (accion === "cambiar_estado" || accion === "cambio_estado") {
    return describirCambioEstado(detalles);
  }

  if (accion === "subir_documento" || accion === "eliminar_documento") {
    return describirDocumento(accion, detalles);
  }

  if (accion === "agregar_nota") return describirNota(detalles);
  if (accion === "factura") return describirFactura(detalles);

  if (accion === "crear") {
    if (modulo === "embarques") return describirEmbarqueCreado(detalles);
    return describirCreacionGenerica(modulo);
  }

  if (accion === "editar" || accion === "editar_cliente") {
    if (modulo === "embarques") return describirEmbarqueEditado(detalles);
    return describirEdicionGenerica(modulo);
  }

  if (accion === "eliminar") return describirEliminacionGenerica(modulo);

  // Fallback: capitalizar acción
  const accionLegible = accion.replace(/_/g, " ");
  const titulo = accionLegible.charAt(0).toUpperCase() + accionLegible.slice(1);
  return { titulo };
}

/** Agrupa acciones para filtros en la UI. */
export const GRUPOS_ACCION = [
  { valor: "todas", etiqueta: "Todas las acciones", acciones: [] as string[] },
  { valor: "crear", etiqueta: "Crear", acciones: ["crear"] },
  { valor: "editar", etiqueta: "Editar", acciones: ["editar", "editar_cliente"] },
  { valor: "eliminar", etiqueta: "Eliminar", acciones: ["eliminar"] },
  { valor: "cambio_estado", etiqueta: "Cambio de estado", acciones: ["cambiar_estado", "cambio_estado"] },
  { valor: "documentos", etiqueta: "Documentos", acciones: ["subir_documento", "eliminar_documento"] },
  { valor: "notas", etiqueta: "Notas", acciones: ["agregar_nota"] },
  { valor: "facturas", etiqueta: "Facturas", acciones: ["factura"] },
] as const;
