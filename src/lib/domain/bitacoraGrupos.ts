/**
 * Agrupaciones de acciones de bitácora para los filtros de UI.
 * Separado de `bitacoraDescripcion.ts` para respetar la regla Power-of-10
 * (≤200 líneas por archivo).
 */
export const GRUPOS_ACCION = [
  { valor: "todas", etiqueta: "Todas las acciones", acciones: [] as string[] },
  { valor: "crear", etiqueta: "Crear", acciones: ["crear"] },
  { valor: "editar", etiqueta: "Editar", acciones: ["editar", "editar_cliente"] },
  { valor: "eliminar", etiqueta: "Eliminar", acciones: ["eliminar"] },
  { valor: "cambio_estado", etiqueta: "Cambio de estado", acciones: ["cambiar_estado", "cambio_estado"] },
  { valor: "documentos", etiqueta: "Documentos", acciones: ["subir_documento", "eliminar_documento"] },
  { valor: "notas", etiqueta: "Notas", acciones: ["agregar_nota"] },
  { valor: "facturas", etiqueta: "Facturas", acciones: ["factura"] },
  { valor: "pagos", etiqueta: "Pagos", acciones: ["pagar", "eliminar_pago"] },
  { valor: "timbrado", etiqueta: "Timbrado", acciones: [
    "facturapi_emitida", "facturapi_cancelada", "facturapi_sustituida",
    "facturapi_nc_emitida", "facturapi_nc_cancelada",
    "facturapi_rep_emitido", "facturapi_rep_cancelado",
    "cfdi_enviado",
  ] },
  { valor: "notas_credito", etiqueta: "Notas de crédito", acciones: [
    "crear_nota_credito", "aplicar_nota_credito", "cancelar_nota_credito",
    "facturapi_nc_emitida", "facturapi_nc_cancelada",
  ] },
] as const;
