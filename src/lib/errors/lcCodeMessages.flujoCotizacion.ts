/** Mensajes del flujo de cotización: plazos de Pricing y autorización interna. */
export const LC_CODE_MESSAGES_FLUJO_COTIZACION: Record<string, string> = {
  LC_CLIENTE_NO_EXISTE: "No se encontró el cliente.",
  LC_COORDINADOR_INVALIDO: "Elige un coordinador válido de la empresa.",
  LC_HANDOVER_NO_EXISTE: "La cotización todavía no tiene ficha de handover.",
  LC_COT_SIN_AUTORIZACION:
    "La cotización necesita autorización de un administrador o del gerente comercial antes de enviarla o aceptarla.",
  LC_COT_EMBARQUE_VIVO:
    "Esta cotización ya tiene embarque. Cancela primero el embarque y después la cotización.",
  LC_COT_AUTORIZACION_SOLO_RPC: "La autorización sólo se cambia con los botones de autorización.",
  LC_COT_TRIGGER_CONTEXTO_INVALIDO:
    "No se pudo validar la autorización de esta cotización. Contacta al administrador.",
  LC_COT_SOLO_AUTORIZADOR: "Sólo un administrador o el gerente comercial puede autorizar cotizaciones.",
  LC_COT_MARGEN_BAJO_MINIMO:
    "El margen está por debajo del mínimo (o no se puede calcular). Escribe una justificación de al menos 10 caracteres para autorizar.",
  LC_PRICING_SOLO_GERENTE_OPS: "Solo el gerente de operaciones o un administrador puede hacer este cambio.",
  LC_PRICING_MOTIVO_REQUERIDO: "Escribe una justificación de al menos 10 caracteres.",
  LC_PRICING_COMPLEJIDAD_INVALIDA: "Elige una complejidad válida.",
  LC_PRICING_PLAZO_NO_AMPLIABLE: "Solo se amplía el plazo de solicitudes especiales enviadas.",
  LC_PRICING_PLAZO_FUERA_DE_TIEMPO: "Ya pasaron las 8 horas para ampliar el plazo.",
  LC_PRICING_HORAS_INVALIDAS: "El nuevo plazo debe ser mayor a 48 h y hasta 720 h.",
};
