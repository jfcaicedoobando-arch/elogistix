// Registro central de plantillas transaccionales.
// Cada plantilla registrada queda disponible para `send-transactional-email`
// mediante su `templateName`.
import type * as React from 'npm:react@19.2.8';

export interface TemplateEntry {
  // Cada plantilla define su propio shape de props; aquí lo dejamos abierto
  // para que el registry pueda alojar componentes heterogéneos.
  component: React.ComponentType<Record<string, unknown>>;
  subject: string | ((data: Record<string, unknown>) => string);
  displayName?: string;
  previewData?: Record<string, unknown>;
  to?: string; // Si se fija, ignora recipientEmail del caller
}

import { template as cotizacionRespuesta } from './cotizacion-respuesta.tsx';
import { template as cotizacionEnviada } from './cotizacion-enviada.tsx';
import { template as proformaEnviada } from './proforma-enviada.tsx';
import { template as facturaEnviada } from './factura-enviada.tsx';
import { template as notaCreditoEnviada } from './nota-credito-enviada.tsx';
import { template as repEnviado } from './rep-enviado.tsx';
import { template as recordatorioCobranza } from './recordatorio-cobranza.tsx';
import { template as estadoCuentaCliente } from './estado-cuenta-cliente.tsx';

export const TEMPLATES: Record<string, TemplateEntry> = {
  'cotizacion-respuesta': cotizacionRespuesta,
  'cotizacion-enviada': cotizacionEnviada,
  'proforma-enviada': proformaEnviada,
  'factura-enviada': facturaEnviada,
  'nota-credito-enviada': notaCreditoEnviada,
  'rep-enviado': repEnviado,
  'recordatorio-cobranza': recordatorioCobranza,
  'estado-cuenta-cliente': estadoCuentaCliente,
};
