/**
 * Aviso (no bloqueante) cuando el embarque ligado al anticipo no coincide con
 * el embarque de la factura a la que se va a aplicar.
 *
 * Decisión de negocio: se advierte y se permite continuar — hay casos legítimos
 * (anticipo general al proveedor, embarque corregido después, etc.).
 */
export interface DesajusteEmbarqueAnticipo {
  hayDesajuste: boolean;
  mensaje: string | null;
}

export function evaluarDesajusteEmbarque(params: {
  anticipoEmbarqueId?: string | null;
  anticipoExpediente?: string | null;
  facturaEmbarqueId?: string | null;
  facturaExpediente?: string | null;
}): DesajusteEmbarqueAnticipo {
  const { anticipoEmbarqueId, anticipoExpediente, facturaEmbarqueId, facturaExpediente } = params;

  // Sin embarque en el anticipo no hay nada que contrastar.
  if (!anticipoEmbarqueId) return { hayDesajuste: false, mensaje: null };
  if (anticipoEmbarqueId === facturaEmbarqueId) return { hayDesajuste: false, mensaje: null };

  const expAnticipo = anticipoExpediente?.trim() || anticipoEmbarqueId.slice(0, 8);

  if (!facturaEmbarqueId) {
    return {
      hayDesajuste: true,
      mensaje: `Este anticipo está ligado al expediente ${expAnticipo} y la factura no está vinculada a ningún embarque. Puedes continuar.`,
    };
  }

  const expFactura = facturaExpediente?.trim() || facturaEmbarqueId.slice(0, 8);
  return {
    hayDesajuste: true,
    mensaje: `Este anticipo está ligado al expediente ${expAnticipo} y la factura pertenece al ${expFactura}. Puedes continuar si es correcto.`,
  };
}
