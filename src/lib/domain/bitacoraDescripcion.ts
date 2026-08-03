/**
 * Generación de descripciones legibles para entradas de bitácora.
 * Función pura: a partir de `accion + modulo + detalles` devuelve un título
 * descriptivo y un contexto secundario opcional.
 *
 * El despacho por módulo (facturacion, cxp, costeo) vive en
 * `bitacoraDescripcionModulos.ts` para respetar Power of 10.
 */
import type { EntradaBitacora } from "@/types/bitacora";
import { formatCurrency } from "@/lib/formatters";
import { humanizarEnum } from "@/lib/ui/enumLabels";
import type { DescripcionBitacora } from "./bitacoraDescripcion.types";
import {
  describirFacturacion,
  describirCxp,
  describirCosteo,
} from "./bitacoraDescripcionModulos";

export type { DescripcionBitacora };

const MODULO_SINGULAR: Record<string, string> = {
  embarques: "embarque",
  clientes: "cliente",
  proveedores: "proveedor",
  cotizaciones: "cotización",
  facturas: "factura",
  facturacion: "factura",
  usuarios: "usuario",
  cxp: "factura de proveedor",
  costeo: "tarifa",
  crm: "oportunidad",
  auditoria: "hallazgo",
  configuracion: "ajuste",
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

function describirGenerica(accion: string, modulo: string): DescripcionBitacora {
  const singular = MODULO_SINGULAR[modulo] ?? "registro";
  if (accion === "crear") {
    const articulo = singular === "cotización" || singular === "factura" ? "una" : "un";
    return { titulo: `Creó ${articulo} ${singular}` };
  }
  if (accion === "editar" || accion === "editar_cliente") return { titulo: `Editó ${singular}` };
  return { titulo: `Eliminó ${singular}` };
}

// eslint-disable-next-line complexity -- despacho por (accion, modulo); ramas lineales sin lógica anidada.
export function describirEntrada(entrada: EntradaBitacora): DescripcionBitacora {
  const detalles = (entrada.detalles ?? {}) as Record<string, unknown>;
  const { accion, modulo } = entrada;

  if (accion === "login") return { titulo: "Inició sesión" };
  if (accion === "cambiar_estado" || accion === "cambio_estado") return describirCambioEstado(detalles);
  if (accion === "subir_documento" || accion === "eliminar_documento") {
    return describirDocumento(accion, detalles);
  }
  if (accion === "agregar_nota") return describirNota(detalles);
  if (accion === "factura") return describirFactura(detalles);

  if (modulo === "facturacion") {
    const r = describirFacturacion(accion, detalles);
    if (r) return r;
  }
  if (modulo === "cxp") {
    const r = describirCxp(accion, detalles);
    if (r) return r;
  }
  if (modulo === "costeo") {
    const r = describirCosteo(accion, entrada.entidad_nombre);
    if (r) return r;
  }

  if (accion === "crear" && modulo === "embarques") return describirEmbarqueCreado(detalles);
  if ((accion === "editar" || accion === "editar_cliente") && modulo === "embarques") {
    return describirEmbarqueEditado(detalles);
  }
  if (accion === "crear" || accion === "editar" || accion === "editar_cliente" || accion === "eliminar") {
    return describirGenerica(accion, modulo);
  }

  // FIX 6 (P3): fallback humanizado (nunca un slug crudo tipo "importacion").
  return { titulo: humanizarEnum(accion) };
}

export { GRUPOS_ACCION } from "./bitacoraGrupos";
