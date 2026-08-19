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

/** Acciones que se describen igual sin importar el módulo. */
const POR_ACCION: Record<
  string,
  (accion: string, detalles: Record<string, unknown>) => DescripcionBitacora
> = {
  login: () => ({ titulo: "Inició sesión" }),
  cambiar_estado: (_a, d) => describirCambioEstado(d),
  cambio_estado: (_a, d) => describirCambioEstado(d),
  subir_documento: describirDocumento,
  eliminar_documento: describirDocumento,
  agregar_nota: (_a, d) => describirNota(d),
  factura: (_a, d) => describirFactura(d),
};

/** Despacho por módulo: el primero que reconozca la acción gana. */
const POR_MODULO: Record<
  string,
  (entrada: EntradaBitacora, detalles: Record<string, unknown>) => DescripcionBitacora | null
> = {
  facturacion: (e, d) => describirFacturacion(e.accion, d),
  cxp: (e, d) => describirCxp(e.accion, d),
  costeo: (e) => describirCosteo(e.accion, e.entidad_nombre),
  embarques: (e, d) => {
    if (e.accion === "crear") return describirEmbarqueCreado(d);
    if (e.accion === "editar" || e.accion === "editar_cliente") return describirEmbarqueEditado(d);
    return null;
  },
};

const ACCIONES_CRUD = new Set(["crear", "editar", "editar_cliente", "eliminar"]);

export function describirEntrada(entrada: EntradaBitacora): DescripcionBitacora {
  const detalles = (entrada.detalles ?? {}) as Record<string, unknown>;
  const { accion, modulo } = entrada;

  const porAccion = POR_ACCION[accion];
  if (porAccion) return porAccion(accion, detalles);

  const porModulo = POR_MODULO[modulo]?.(entrada, detalles);
  if (porModulo) return porModulo;

  if (ACCIONES_CRUD.has(accion)) return describirGenerica(accion, modulo);

  // FIX 6 (P3): fallback humanizado (nunca un slug crudo tipo "importacion").
  return { titulo: humanizarEnum(accion) };
}


export { GRUPOS_ACCION } from "./bitacoraGrupos";
